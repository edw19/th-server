require('dotenv').config({ path: '.env' })
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
import fs from 'fs'
import { AuthenticationError } from "apollo-server-express";
import { totalPermisosFuncion } from "./helpers";
import { totalPermisosReportes } from "./helpers";
import exceltojson from 'convert-excel-to-json';
const ObjectId = mongoose.Types.ObjectId;

// generar token de autenticación
const crearToken = (usuario, secreto, expiresIn) => {
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
    estasAutenticado: (_, { token }) => {
      try {
        jwt.verify(token, process.env.MI_CODIGO_SECRETO);
        return true;
      } catch (error) {
        throw new Error('Sesión ha caducado')
      }
    },
    // Reportes 
    obtenerSaldoVacionesPermisosFuncionarios: async (_, { periodo, tipoFuncionario }) => {
      let funcionarios = []
      if (tipoFuncionario === '*') {
        funcionarios = await Funcionario.aggregate([
          { $lookup: { from: 'permisos', localField: '_id', foreignField: 'funcionario', as: 'permisos' } },
          { $lookup: { from: 'vacaciones', localField: '_id', foreignField: 'funcionario', as: 'vacaciones' } },
        ]).sort({ apellido: 1 });
      } else {
        funcionarios = await Funcionario.aggregate([
          { $match: { tipoFuncionario, } },
          { $lookup: { from: 'permisos', localField: '_id', foreignField: 'funcionario', as: 'permisos' } },
          { $lookup: { from: 'vacaciones', localField: '_id', foreignField: 'funcionario', as: 'vacaciones' } }
        ]).sort({ apellido: 1 });
      }
      funcionarios.forEach(funcionario => {
        funcionario.permisos = Object.keys(funcionario.permisos.filter(per => per.descontado === true && per.estado === true && per.periodo == periodo)).length;
        funcionario.vacaciones = Object.keys(funcionario.vacaciones.filter(vac => vac.estado === true && vac.periodo == periodo)).length;
      })
      return funcionarios;
    },
    obtenerPermisosReporte: async (_, { id, periodo }) => {
      const reporte = {};
      const res = await Permisos.find({ funcionario: id, estado: true, descontado: true, periodo }).exec();
      const resultado = await totalPermisosReportes(id, periodo);
      reporte.permisos = res
      reporte.resultado = resultado
      return reporte;
    },
    // usuarios
    obtenerUsuarios: async (_, __, { usuario }) => {
      if (usuario.rol !== "ADMINISTRADOR") throw new Error("No privilegios para realizar esta acción");
      return await Usuarios.find().exec();
    },
    // obtener todos los funcionarios
    obtenerFuncionarios: async (_, __, { usuario }) => {
      // if (usuario.rol !== "ADMINISTRADOR") throw new Error('No privilegios para realizar esta acción')
      return await Funcionario.find({}).sort({ apellido: 1 }).exec();
    },
    // DASHBOARD
    numeroEmpleadosPorTipo: async () => {
      const docentes = await Funcionario.find({
        tipoFuncionario: "DOCENTE",
      }).countDocuments();
      const administrativos = await Funcionario.find({
        tipoFuncionario: "ADMINISTRATIVO",
      }).countDocuments();
      const codigoLaboral = await Funcionario.find({
        tipoFuncionario: "CÓDIGO DE TRABAJO",
      }).countDocuments();
      return [
        { name: "Docentes", valor: docentes },
        { name: "Administrativos", valor: administrativos },
        { name: "Código", valor: codigoLaboral },
        { name: "Total", valor: docentes + administrativos + codigoLaboral },
      ];
    },
    porcentajeHombreMujeres: async () => {
      const funcionarioFemenino = await Funcionario.aggregate([
        { $match: { genero: "FEMENINO" } },
        { $count: "femenino" },
      ]);
      const funcionarioMasculino = await Funcionario.aggregate([
        { $match: { genero: "MASCULINO" } },
        { $count: "masculino" },
      ]);
      const total = await Funcionario.countDocuments();


      const porcentajeFemenino = (funcionarioFemenino[0].femenino * 100) / total;
      const porcentajeMasculino = (funcionarioMasculino[0].masculino * 100) / total;
      return [
        {
          genero: "Masculino",
          porcentaje: Math.round(porcentajeMasculino),
          value: funcionarioMasculino[0].masculino,
        },
        { genero: "Femenino", porcentaje: Math.round(porcentajeFemenino), value: funcionarioFemenino[0].femenino },
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
        { genero: "Hombres", fechas: fechasM },
        { genero: "Mujeres", fechas: fechasF },
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
          porcentaje: Math.round(porcentaje, -1),
          total: funcionariosDiscapacidad,
        },
      ];
    },

    // contratos
    obtenerContratos: async (_, { funcionario, periodo, limite, offset }) => {
      const totalContratos = await Contratos.find({
        funcionario,
        periodo
      }).countDocuments();
      const contratos = await Contratos.find({ funcionario, periodo })
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
      return totalPermisosFuncion(id, idPeriodo)
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
    obtenerUsuario: async (_, __, { usuario }) => {
      return Usuarios.findById(usuario.id).exec()
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
    // descontar permisos masivos
    descontarPermisosMasivo: async (_, { idPeriodo }) => {
      const idsFuncionarioConPermisos = await Permisos.find({ descontado: false, periodo: idPeriodo }).distinct("funcionario");
      if (Object.keys(idsFuncionarioConPermisos).length === 0) {
        throw new Error("Funcionarios sin permisos para descontar")
      }
      console.log(idsFuncionarioConPermisos)
      idsFuncionarioConPermisos.forEach(async idFun => {
        const res = await totalPermisosFuncion(idFun, idPeriodo);
        console.log(res)
        const funcionario = await Funcionario.findById(idFun);
        console.log(funcionario)
        if (res.totalDias === 0) {
          await Funcionario.findOneAndUpdate({ _id: idFun }, { $set: { horasAcumuladas: res.totalHoras, minutosAcumulados: res.totalMinutos } }).exec();
          await Permisos.updateMany({ funcionario: idFun, periodo: idPeriodo }, { $set: { descontado: true } })
          return;
        };
        if (funcionario.diasAFavor < res.totalDias) return;
        await Funcionario.updateOne({ _id: idFun }, { $set: { diasAFavor: funcionario.diasAFavor - res.totalDias, minutosAcumulados: res.totalMinutos, horasAcumuladas: res.totalHoras } })
        await Permisos.updateMany({ funcionario: idFun, periodo: idPeriodo }, { $set: { descontado: true } })
      })
      return "Permisos descontados"
    },
    // recuparContraseña 
    recuperarPassword: async (_, { correo }) => {
      const existe = await Usuarios.find({ correo }).exec();
      if (Object.keys(existe).length === 0) return new Error("Este email no esta asociado a ninguna cuenta");
      const nuevoPassword = generarPasswordFuncion();
      await Usuarios.findOneAndUpdate({ correo }, { id: existe[0]._id, nuevoPassword }).exec();

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
    crearUsuario: async (_, { rol, nombre, password, correo }, { usuario }) => {
      if (usuario.rol !== "ADMINISTRADOR") throw new Error("No tienes los privilegios suficientes")
      const existeUsuario = await Usuarios.findOne({ correo });
      if (existeUsuario) {
        throw new Error("El usuario ya existe");
      }
      const nuevoUsuario = new Usuarios({
        rol,
        nombre,
        password,
        correo
      });
      await nuevoUsuario.save();
      return 'Has creado un nuevo Usuario';
    },
    actualizarUsuario: async (_, { input }) => {
      try {
        await Usuarios.updateOne({ _id: input.id }, { rol: input.rol, nombre: input.nombre, correo: input.correo }).exec();
        await Usuarios.findOneAndUpdate(
          { _id: input.id },
          { correo: input.correo, nuevoPassword: input.nuevoPassword }).exec();
        return "Actualizado Correctamente";
      } catch (error) {
        console.log(error)
      }
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
    cambiarRolUsuario: async (_, { id, rol }, { usuario }) => {
      if (usuario.rol !== "ADMINISTRADOR") throw new AuthenticationError("no tienes privilegios para realizar esta acción")
      try {
        await Usuarios.updateOne({ _id: id }, { rol }).exec();
        return "Rol de usuario cambiado correctamente"
      } catch (error) {
        console.log(error)
        throw new Error("Hubo un error")
      }
    },
    eliminarUsuario: async (_, { id }, { usuario }) => {
      if (usuario.rol !== "ADMINISTRADOR") throw new AuthenticationError("no tienes privilegios para realizar esta acción");
      try {
        await Usuarios.findOneAndDelete({ _id: id }).exec();
        return "Usuario eliminado"
      } catch (error) {
        console.log(error)
        throw new Error("Hubo un error")
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
        await Contratos.deleteMany({ periodo: id });
        return "Periodo eliminado";
      } catch (error) {
        console.log(error);
      }
    },
    // vacaciones
    actualizarDiasHabiles: async (_, { id, dias, sumar }) => {
      const funcionarioExiste = await Funcionario.findOne({ _id: id });
      if (!funcionarioExiste) throw new Error("Funcionario no existe");
      // if (dias > funcionarioExiste.diasAFavor)
      //   throw new Error("Días a favor insuficientes");

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
        motivo: input.motivo,
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
      if (dias === 0) {
        await Permisos.updateMany(
          { funcionario, periodo },
          { descontado: true }
        );
        return "Permisos agregados al reporte"
      }

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
      const tieneDias = await Funcionario.findById(input.funcionario);
      if (tieneDias.diasAFavor <= 1) throw new Error("Este Funcionario no tiene días disponibles suficientes");
      const nuevoPermiso = new Permisos({
        funcionario: input.funcionario,
        periodo: input.periodo,
        fechaSalida: input.fechaSalida,
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
      try {
        await Funcionario.findOneAndDelete({ _id: id }, function (err, func) {
          if (err) throw new Error('No se pudo eliminar el funcionario')
          else {
            if (func) {
              if (func.nombreImagen) {
                try {
                  fs.unlinkSync(path.join(__dirname, `../static/imagenes/${func.nombreImagen}`))
                } catch (error) {
                  console.log(error)
                }
              }
            }
          }
        });
        await Permisos.deleteMany({ funcionario: id });
        await Vacaciones.deleteMany({ funcionario: id });
        return "Datos del funcionario eliminados correctamente"
      } catch (error) {
        throw new Error("Hubo un error eliminando registros del funcionario")
      }
    },
    autenticarUsuario: async (_, { email, password }) => {
      const usuario = await Usuarios.findOne({ correo: email }).exec();
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
      const usuarioPayload = {
        id: usuario._id,
        rol: usuario.rol,
        nombre: usuario.nombre,
        correo: usuario.correo
      }

      return {
        token: crearToken(usuarioPayload, process.env.MI_CODIGO_SECRETO, "7d"),
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
    fileMasivo: async (_, { file }) => {
      const { createReadStream, filename } = await file;
      await new Promise((resolve) => {
        createReadStream().pipe(
          createWriteStream(
            path.join(__dirname, "../static/masivo/", filename)
          )
        ).on('data', async (doc) => {
          console.log(doc)
        })
          .on('close', resolve)
      })

      const excel = exceltojson({
        sourceFile: path.join(__dirname, `../static/masivo/${filename}`)
      });

      let funcionarios = [];
      let error = false;
      let mensaje = ""

      for (let x = 0; x < excel.Funcionarios.length; x++) {
        if (x > 0) {
          for (let y = 0; y < excel.Funcionarios.length; y++) {
            if (y > 0 && x !== y) {
              if (excel.Funcionarios[x].A === excel.Funcionarios[y].A) {
                error = true;
                mensaje = `Registros duplicados en la celda A${y + 1} y A${x + 1}`
                break;
              }
            }
          }
        }
      }

      if (error) {
        throw new Error(`El documento contiene números de cédula duplicados. Revisar el campo cédula. ${mensaje}`)
      }


      for (let i = 0; i < excel.Funcionarios.length; i++) {
        let funcionario = {}
        if (i > 0) {
          const existe = await Funcionario.findOne({ cedula: excel.Funcionarios[i].A });
          if (existe) {
            mensaje = `registro duplicado en la celda A${i + 1}`
            error = true;
            break;
          }
          funcionario.cedula = excel.Funcionarios[i].A;
          funcionario.tipoFuncionario = excel.Funcionarios[i].B;
          funcionario.fechaIngreso = excel.Funcionarios[i].C;
          funcionario.fechaSalida = excel.Funcionarios[i].D;
          funcionario.nombre = excel.Funcionarios[i].E;
          funcionario.segundoNombre = excel.Funcionarios[i].F;
          funcionario.apellido = excel.Funcionarios[i].G;
          funcionario.segundoApellido = excel.Funcionarios[i].H;
          funcionario.nacionalidad = excel.Funcionarios[i].I;
          funcionario.tipoVinculacion = excel.Funcionarios[i].J;
          funcionario.fechaNacimiento = excel.Funcionarios[i].K;
          const titulos = []
          const titulosSplit = excel.Funcionarios[i].L.split(',')
          titulosSplit.forEach((tit, index) => {
            let titulo = {};
            titulo.nombre = tit;
            titulo.principal = index === 0 ? true : false;
            titulos.push(titulo);
          });
          funcionario.tituloProfesional = titulos
          funcionario.genero = excel.Funcionarios[i].M;
          funcionario.tipoSangre = excel.Funcionarios[i].N;
          funcionario.estadoCivil = excel.Funcionarios[i].O;
          funcionario.discapacidad = excel.Funcionarios[i].P.toUpperCase() === 'SI' ? true : false;
          funcionario.discapacidadDetalles = typeof excel.Funcionarios[i].Q === 'undefined' ? '' : excel.Funcionarios[i].Q;
          funcionario.nombreImagen = "";
          funcionario.diasAFavor = excel.Funcionarios[i].R;
          funcionarios.push(funcionario);
        }
      }

      if (error) {
        throw new Error(`EL documento proporcionado contiene funcionarios que ya estan registrados en el sistema, ${mensaje}`)
      }

      try {
        await Funcionario.insertMany(funcionarios);
        unlinkSync(
          path.join(__dirname, `../static/masivo/${filename}`)
        );
        return `${Object.keys(funcionarios).length} Funcionarios Registrados correctamente`
      } catch (error) {
        throw new Error("Hubo un error con el documento proporcionado")
      }
    }

  },
};
