require('dotenv').config({path: '.env'})
import mongoose, { model, Schema } from "mongoose";
import bcrypt from "bcrypt";

mongoose.Promise = global.Promise;
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);

const URI = process.env.MONGOOSE_URI
  ? process.env.MONGOOSE_URI
  : "mongodb://localhost/t-humano";
  
mongoose.connect(URI, { useNewUrlParser: true, useUnifiedTopology: true });

const usuariosSchema = new Schema({
  usuario: String,
  nombre: String,
  correo: String,
  password: String,
});

const funcionarioSchema = new Schema({
  cedula: String,
  nombre: String,
  segundoNombre: String,
  apellido: String,
  segundoApellido: String,
  nacionalidad: String,
  tipoVinculacion: String,
  tipoFuncionario: String,
  fechaNacimiento: String,
  tituloProfesional: String,
  genero: String,
  tipoSangre: String,
  estadoCivil: String,
  discapacidad: Boolean,
  discapacidadDetalles: String,
  nombreImagen: String,
  diasAFavor: Number,
  diasAcumulados: {
    type: Number,
    default: 0,
  },
  horasAcumuladas: {
    type: Number,
    default: 0,
  },
  minutosAcumulados: {
    type: Number,
    default: 0,
  },
  creado_en: {
    type: Date,
    default: Date.now,
  },
});

const permisosSchema = new Schema({
  funcionario: mongoose.Types.ObjectId,
  periodo: mongoose.Types.ObjectId,
  horaSalida: String,
  horasPermiso: Number,
  minutosPermiso: Number,
  motivo: String,
  descontado: {
    type: Boolean,
    default: false,
  },
  estado: Boolean,
  creado_en: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

const vacacionesSchema = new Schema({
  funcionario: mongoose.Types.ObjectId,
  periodo: mongoose.Types.ObjectId,
  fechaSalida: String,
  fechaEntrada: String,
  diasSolicitados: Number,
  estado: {
    type: Boolean,
    default: true,
  },
  creado_en: {
    type: Date,
    default: Date.now,
  },
});

const periodoSchema = new Schema({
  nombre: {
    type: String,
    required: true,
  },
  vigente: {
    type: Boolean,
    default: false,
  },
  fechaInicio: String,
  fechaFinal: String,
});

const contratosSchema = new Schema({
  funcionario: mongoose.Types.ObjectId,
  periodo: mongoose.Types.ObjectId,
  nombrePeriodo: String,
  nombreArchivo: String,
  tipoContrato: String,
  contrato: Boolean,
  nombramiento: Boolean,
  fechaInicioActividades: String,
  creado_en: {
    type: Date,
    default: Date.now,
  },
});

//hashear password de usuarios antes de guardar
usuariosSchema.pre("findOneAndUpdate", function (next) {
  console.log(this._update.nuevoPassword)
  console.log(this._update.id)
  if(this._update.nuevoPassword === "") next();

  if (this.getUpdate()) {
    bcrypt.genSalt(10, (error, salt) => {
      if (error) return next(error);
      bcrypt.hash(this._update.nuevoPassword, salt, (error, hash) => {
        if (error) return next(error);
        this.updateOne({ _id: this._update.id }, { password: hash });
        next();
      });
    });
  }
});
usuariosSchema.pre("save", function (next) {
  // si el password no esta modificado ejecutar la siguiente acción
  if (!this.isModified("password")) {
    return next();
  }
  bcrypt.genSalt(10, (error, salt) => {
    if (error) return next(error);
    bcrypt.hash(this.password, salt, (error, hash) => {
      if (error) return next(error);
      this.password = hash;
      next();
    });
  });
});

export const Usuarios = model("usuarios", usuariosSchema);
export const Funcionario = model("funcionario", funcionarioSchema);
export const Permisos = model("permisos", permisosSchema);
export const Vacaciones = model("vacaciones", vacacionesSchema);
export const Periodo = model("periodo", periodoSchema);
export const Contratos = model("contratos", contratosSchema);
