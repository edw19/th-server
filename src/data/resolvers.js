require('dotenv').config({ path: 'variables.env' })
import {
  Usuarios,
  Funcionario,
  Permisos,
  Vacaciones,
  Periodo,
  Contratos,
} from "./db";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createWriteStream, unlinkSync } from "fs";
import path from "path";
import mail from 'nodemailer';
const ObjectId = mongoose.Types.ObjectId;



// generar token de autenticación
const crearToken = (usuarioLogin, secreto, expiresIn) => {
  const { usuario } = usuarioLogin;
  return jwt.sign({ usuario }, secreto, { expiresIn });
};

const generarPasswordFuncion = () => {
  const LONGITUD = 10;
  const caracteres = "abcdefghijkmnpqrtuvwxyzABCDEFGHIJKLMNPQRTUVWXYZ2346789";
  let password = "";
  for (let i = 0; i < LONGITUD; i++) {
    password += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return password;
}

let imagen = [];

export const resolvers = {
  Query: {
    // DASHBOARD
    numeroEmpleadosPorTipo: async () => {
      const docentes = await Funcionario.find({
        tipoFuncionario: "DOCENTE",
      }).countDocuments();
      const administrativos = await Funcionario.find({
        tipoFuncionario: "ADMINISTRATIVO",
      }).countDocuments();
      const codigoLaboral = await Funcionario.find({
        tipoFuncionario: "CÓDIGO LABORAL",
      }).countDocuments();
      return [
        { name: "Docentes", numero: docentes },
        { name: "Administrativos", numero: administrativos },
        { name: "CódigoLaboral", numero: codigoLaboral },
      ];
    },
    porcentajeHombreMujeres: async () => {
      const [{ femenino }] = await Funcionario.aggregate([
        { $match: { genero: "FEMENINO" } },
        { $count: "femenino" },
      ]);
      const [{ masculino }] = await Funcionario.aggregate([
        { $match: { genero: "MASCULINO" } },
        { $count: "masculino" },
      ]);
      const total = await Funcionario.countDocuments();

      const porcentajeFemenino = (femenino * 100) / total;
      const porcentajeMasculino = (masculino * 100) / total;

      return [
        {
          genero: "Masculino",
          porcentaje: porcentajeMasculino,
          value: masculino,
        },
        { genero: "Femenino", porcentaje: porcentajeFemenino, value: femenino },
      ];
    },
    edadPromedioMF: async () => {
      const fechasNacimientoM = await Funcionario.find({
        genero: "MASCULINO",
      }).exec();
      const fechasNacimientoF = await Funcionario.find({
        genero: "FEMENINO",
      }).exec();
      const fechasM = [];
      const fechasF = [];
      fechasNacimientoM.forEach((funcionario) => {
        fechasM.push({ fecha: funcionario.fechaNacimiento });
      });
      fechasNacimientoF.forEach((funcionario) => {
        fechasF.push({ fecha: funcionario.fechaNacimiento });
      });
      return [
        { genero: "Masculino", fechas: fechasM },
        { genero: "Femenino", fechas: fechasF },
      ];
    },
    masPermisos: async () => {
      const res = await Permisos.aggregate([
        { $match: { estado: true } },
        {
          $group: {
            _id: "$funcionario",
            permisos: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "funcionarios",
            localField: "_id",
            foreignField: "_id",
            as: "funcionario",
          },
        },
        { $sort: { permisos: -1 } },
        { $limit: 5 },
      ]);
      return res;
    },
    tendenciaPermisos: async () => {
      const res = await Permisos.aggregate([{ $group: { _id: "$creado_en" } }]);
      const fechas = [];
      res.forEach((fecha) => {
        fechas.push(fecha._id.toString());
      });
      return fechas;
    },
    porcentajeFuncionarioDiscapacidad: async () => {
      const funcionariosDiscapacidad = await Funcionario.find({
        discapacidad: true,
      })
        .countDocuments()
        .exec();
      const totalFuncionario = await Funcionario.find({})
        .countDocuments()
        .exec();
      const porcentaje = (funcionariosDiscapacidad * 100) / totalFuncionario;
      return [
        {
          porcentaje: Math.ceil(porcentaje),
          total: funcionariosDiscapacidad,
        },
      ];
    },

    // contratos
    obtenerContratos: async (_, { funcionario, limite, offset }) => {
      const totalContratos = await Contratos.find({
        funcionario,
      }).countDocuments();
      const contratos = await Contratos.find({ funcionario })
        .sort({ creado_en: -1 })
        .limit(limite)
        .skip(offset);
      return { contratos, totalContratos };
    },
    // periodo
    obtenerPeriodos: async (_, { limite, offset }) => {
      const periodos = await Periodo.find({})
        .limit(limite)
        .skip(offset)
        .sort({ vigente: -1 });
      const totalPeriodos = await Periodo.countDocuments();
      return { periodos, totalPeriodos };
    },
    // vacaciones
    obtenerVacaciones: async (_, { id, idPeriodo, limite, offset }) => {
      const vacaciones = await Vacaciones.find({
        funcionario: id,
        periodo: idPeriodo,
      })
        .sort({ creado_en: -1 })
        .limit(limite)
        .skip(offset);
      if (!vacaciones) throw new Error("Este funcionario no tiene vacaciones");
      const totalVacaciones = await Vacaciones.find({
        funcionario: id,
        periodo: idPeriodo,
      }).countDocuments();
      const totalDiasDescontados = await Vacaciones.aggregate([
        {
          $match: {
            funcionario: ObjectId(id),
            periodo: ObjectId(idPeriodo),
            estado: true,
          },
        },
        {
          $group: {
            _id: "$funcionario",
            totalDiasDescontados: { $sum: "$diasSolicitados" },
          },
        },
      ]);

      return {
        vacaciones,
        totalVacaciones,
        totalDiasDescontados:
          Object.keys(totalDiasDescontados).length > 0
            ? totalDiasDescontados[0].totalDiasDescontados
            : 0,
      };
    },
    //permisos
    totalPermisos: async (root, { id, idPeriodo }) => {
      const numeroDePermisos = await Permisos.countDocuments({
        funcionario: id,
        periodo: idPeriodo,
        descontado: false,
      });
      const acumulados = await Funcionario.findById(id);
      const resultado = await Permisos.aggregate([
        {
          $match: {
            funcionario: ObjectId(id),
            estado: true,
            descontado: false,
            periodo: ObjectId(idPeriodo),
          },
        },
        {
          $group: {
            _id: "$funcionario",
            totalHoras: { $sum: "$horasPermiso" },
            totalMinutos: { $sum: "$minutosPermiso" },
          },
        },
      ]);
      let totalHoras = 0;
      let totalMinutos = 0;

      if (Object.keys(resultado).length > 0) {
        totalHoras = resultado[0].totalHoras + acumulados.horasAcumuladas;
        totalMinutos = resultado[0].totalMinutos + acumulados.minutosAcumulados;
      }

      const TotalPermisos = {
        totalPermisos: numeroDePermisos,
        totalHoras,
        totalHorasSin: totalHoras,
        totalMinutos,
        totalMinutosSin: totalMinutos,
        totalDias: 0,
      };

      let dias = 0;
      let horas = !TotalPermisos.totalHoras ? 0 : TotalPermisos.totalHoras;
      let minutos = !TotalPermisos.totalMinutos
        ? 0
        : TotalPermisos.totalMinutos;

      if (TotalPermisos.totalMinutos >= 60) {
        horas = Math.trunc(TotalPermisos.totalMinutos / 60);
        minutos = TotalPermisos.totalMinutos % 60;
        horas += TotalPermisos.totalHoras;
        TotalPermisos.totalMinutos = minutos;
      }
      if (horas >= 8) {
        dias = Math.trunc(horas / 8);
        horas = horas % 8;
        if (dias > 0) {
          TotalPermisos.totalDias = dias;
          TotalPermisos.totalHoras = horas;
        }
      }
      return TotalPermisos;
    },
    obtenerPermisos: async (root, { id, idPeriodo, limite, offset }) => {
      const permisos = await Permisos.find({
        funcionario: id,
        periodo: idPeriodo,
        descontado: false,
      })
        .sort([["creado_en", -1]])
        .limit(limite)
        .skip(offset);
      if (!permisos) throw new Error("Este funcionario no tiene permisos");
      return permisos;
    },
    // usuario
    obtenerUsuario: async () => {
      const usuario = await Usuarios.findOne();
      return usuario;
    },
    //funcionarios
    obtenerFuncionario: async (root, { cedula }) => {
      const existeFuncionario = await Funcionario.findOne({ cedula });
      if (!existeFuncionario) throw new Error("Funcionario no encontrado");
      return existeFuncionario;
    },
    // query imagenes
    mostrarImagen: () => imagen,
  },
  Mutation: {
    // recuparContraseña 
    recuperarPassword: async (_, { correo }) => {
      const existe = await Usuarios.find({ correo }).exec();
      if (Object.keys(existe).length === 0) return new Error("Este email no esta asociado a ninguna cuenta");
      const nuevoPassword = generarPasswordFuncion();
      await Usuarios.findOneAndUpdate({ correo }, {id: existe[0]._id, nuevoPassword}).exec();

      let transporter = mail.createTransport({
        host: 'smtp.googlemail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.MY_EMAIL,
          pass: process.env.MY_PASSWORD
        }
      });

      let opcionesEmail = {
        from: process.env.MY_EMAIL,
        to: correo,
        subject: "Administrador del sistema de talento humano",
        html: `
        <div>
        <h3>Contraseña Temporal</h3>
        <p>Recomentamos cambiar esta contraseña temporal para envitar problemas de seguridad</p>
        <p>Tu contraseña temporal es: ${nuevoPassword}</p>
        </div>
        `
      }
      try {
        await transporter.sendMail(opcionesEmail);
        return "Se ha enviado un mensaje a tu dirección de correo electrónico, verificala."
      } catch (error) {
        console.log(error)
      }
    },
    // usuario
    crearUsuario: async (_, { usuario, nombre, password }) => {
      const existeUsuario = await Usuarios.findOne({ usuario });
      if (existeUsuario) {
        throw new Error("El usuario ya existe");
      }
      const nuevoUsuario = new Usuarios({
        usuario,
        nombre,
        password,
      });
      nuevoUsuario.save();
      return `Bienvenido ${usuario}, has activado tu cuenta`;
    },
    actualizarUsuario: async (_, { input }) => {
      await Usuarios.findOneAndUpdate(input.id, { ...input }).exec();
      return "actualizado";
    },
    verificarPassword: async (_, { id, password }) => {
      try {
        const usuario = await Usuarios.findById(id).exec();
        const res = await bcrypt.compare(password, usuario.password);
        if (!res) return false;
        return res;
      } catch (error) {
        throw new Error(error)
      }
    },
    // contratos
    eliminarContrato: async (_, { id, nombreArchivo }) => {
      try {
        unlinkSync(
          path.join(__dirname, `../static/contratos/${nombreArchivo}`)
        );
        await Contratos.findOneAndDelete({ _id: ObjectId(id) });
        return "Documento eliminado correctamente";
      } catch (error) {
        throw new Error("No se elimino el documento");
      }
    },
    guardarContrato: async (_, { input }) => {
      const nuevoContrato = new Contratos({ ...input });
      const { createReadStream, filename } = await input.archivo;
      await new Promise((res, rej) => {
        nuevoContrato.save((error) => {
          if (error) rej("No se pudo guardar el contrato");
          else res("Archivo Guardado Correctamente");
        });
      });

      await new Promise((resolve) => {
        createReadStream()
          .pipe(
            createWriteStream(
              path.join(__dirname, "../static/contratos", filename)
            )
          )
          .on("close", resolve)
          .on("error", (e) => {
            return new Error(`archivo no sorportado ${e}`);
          });
      });
      return "Guardado correctamente";
    },

    // periodo
    crearPeriodo: async (_, { nombre, fechaInicio, fechaFinal }) => {
      const nuevoPeriodo = new Periodo({
        nombre,
        fechaInicio,
        fechaFinal,
      });

      return new Promise((res, rej) => {
        nuevoPeriodo.save((error) => {
          if (error) rej("No se pudo agregar el periodo");
          else res("Periodo agregado correctamente");
        });
      });
    },
    hacerVigente: async (_, { id }) => {
      try {
        await Periodo.updateMany({}, { $set: { vigente: false } });
        await Periodo.findByIdAndUpdate(id, { $set: { vigente: true } });
        return "Periodo Actualizado";
      } catch (error) {
        console.log(error);
      }
    },
    eliminarPeriodo: async (_, { id }) => {
      try {
        await Periodo.findOneAndDelete({ _id: id });
        await Permisos.deleteMany({ periodo: id });
        await Vacaciones.deleteMany({ periodo: id });
        return "Periodo eliminado";
      } catch (error) {
        console.log(error);
      }
    },
    // vacaciones
    actualizarDiasHabiles: async (_, { id, dias, sumar }) => {
      const funcionarioExiste = await Funcionario.findOne({ _id: id });
      if (!funcionarioExiste) throw new Error("Funcionario no existe");
      if (dias > funcionarioExiste.diasAFavor)
        throw new Error("Días a favor insuficientes");

      if (sumar) {
        await Funcionario.findOneAndUpdate(
          { _id: id },
          { $set: { diasAFavor: funcionarioExiste.diasAFavor + dias } }
        );
      }
      if (!sumar) {
        await Funcionario.findOneAndUpdate(
          { _id: id },
          { $set: { diasAFavor: funcionarioExiste.diasAFavor - dias } }
        );
      }
      return "días a favor actualizados correctamente";
    },
    eliminarVacacion: async (_, { id }) => {
      return new Promise((res, rej) => {
        Vacaciones.findOneAndDelete({ _id: id }, (error) => {
          if (error) rej("No se encuentra esta vacación, refresca la página");
          else res("Eliminada Correctamente");
        });
      });
    },
    guardarVacacion: async (_, { input }) => {
      const nuevaVacacion = new Vacaciones({
        funcionario: input.funcionario,
        periodo: input.periodo,
        fechaSalida: input.fechaSalida,
        fechaEntrada: input.fechaEntrada,
        diasSolicitados: input.diasSolicitados,
      });
      const { diasAFavor } = await Funcionario.findOne({
        _id: input.funcionario,
      });
      await Funcionario.findOneAndUpdate(
        { _id: input.funcionario },
        { $set: { diasAFavor: diasAFavor - input.diasSolicitados } }
      );

      return new Promise((res, rej) => {
        nuevaVacacion.save((error) => {
          if (error) rej(error);
          else res("Vacación Agregada Correctamente");
        });
      });
    },
    actualizarEstadoVacacion: async (_, { id, estado }) => {
      return new Promise((res, rej) => {
        Vacaciones.findOneAndUpdate(
          { _id: id },
          { $set: { estado: !estado } },
          (error) => {
            if (error) return rej(error);
            else res("Actualizado el estado de la vacación");
          }
        );
      });
    },

    // permisos
    descontarPermisos: async (
      _,
      {
        funcionario,
        periodo,
        diasAFavor,
        horasAcumuladas,
        minutosAcumulados,
        dias,
        horas,
        minutos,
      }
    ) => {
      if (horasAcumuladas > 0 || minutosAcumulados > 0) {
        await Funcionario.findByIdAndUpdate(funcionario, {
          horasAcumuladas: 0,
          minutosAcumulados: 0,
        });
      }

      if (dias || horas || minutos) {
        await Permisos.updateMany(
          { funcionario, periodo },
          { descontado: true }
        );
        await Funcionario.findByIdAndUpdate(funcionario, {
          diasAFavor: diasAFavor - dias,
          horasAcumuladas: horas,
          minutosAcumulados: minutos,
        });
      }
      return "Permisos descontados con éxito";
    },
    actualizarEstadoPermiso: async (_, { id, estado }) => {
      return new Promise((res, rej) => {
        Permisos.findOneAndUpdate(
          { _id: id },
          { $set: { estado: !estado } },
          (error) => {
            if (error) return rej(error);
            else res("Actualizado el estado del permiso");
          }
        );
      });
    },
    crearPermiso: async (_, { input }) => {
      const nuevoPermiso = new Permisos({
        funcionario: input.funcionario,
        periodo: input.periodo,
        permiso: input.permiso,
        horaSalida: input.horaSalida,
        horasPermiso: input.horasPermiso,
        minutosPermiso: input.minutosPermiso,
        motivo: input.motivo,
        estado: input.estado,
      });

      return new Promise((resolve, rejects) => {
        nuevoPermiso.save((error) => {
          if (error) rejects(error);
          else resolve("Permiso agregado correctamente");
        });
      });
    },
    eliminarPermiso: async (root, { id }) => {
      return new Promise((resolve, reject) => {
        Permisos.findOneAndDelete({ _id: id }, (error) => {
          if (error) reject(error);
          else resolve("Permiso Eliminado");
        });
      });
    },

    crearFuncionario: async (root, { input }) => {
      const existeFuncionario = await Funcionario.findOne({
        cedula: input.cedula,
      });
      if (existeFuncionario) {
        throw new Error("El Funcionario ya existe");
      }

      const nuevoFuncionario = new Funcionario({ ...input });

      return new Promise((resolve) => {
        nuevoFuncionario.save((error) => {
          if (error) {
            return new Error("Error al momento de almacenar el usuario");
          }
          imagen = [];
          return resolve("Funcionario Creado Correctamente");
        });
      });
    },
    actualizarFuncionario: async (root, { input }) => {
      return new Promise((resolve, reject) => {
        Funcionario.findOneAndUpdate({ _id: input.id }, input, (error) => {
          if (error) reject(error);
          else resolve("Funcionario Actualizado Correctamente");
        });
      });
    },
    eliminarFuncionario: async (root, { id }) => {
      return new Promise((resolve, reject) => {
        Funcionario.findOneAndDelete({ _id: id }, (error) => {
          if (error) reject(error);
          else resolve("El Funcionario ha sido Eliminado Correctamente");
        });
      });
    },
    autenticarUsuario: async (root, { email, password }) => {
      const usuario = await Usuarios.findOne({ correo: email });
      if (!usuario) {
        throw new Error("Usuario no Encontrado");
      }

      const passwordCorrecto = await bcrypt.compare(
        password,
        usuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("La Contraseña no Coincide");
      }

      return {
        token: crearToken(email, process.env.MI_CODIGO_SECRETO, "1d"),
      };
    },
    // Imagenes

    uploadFile: async (_, { file }) => {
      const { createReadStream, filename } = await file;
      await new Promise((resolve) => {
        createReadStream()
          .pipe(
            createWriteStream(
              path.join(__dirname, "../static/imagenes", filename)
            )
          )
          .on("close", resolve)
          .on("error", (e) => {
            return new Error(`archivo no sorportado ${e}`);
          });
      });
      imagen = [];
      imagen.push(filename);
      return true;
    },
  },
};
