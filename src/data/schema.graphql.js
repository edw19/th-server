import gql from 'graphql-tag';

export const typeDefs = gql`
type Funcionario {
  id: ID
  cedula: String
  nombre: String
  segundoNombre: String
  apellido: String
  segundoApellido: String
  nacionalidad: String
  tipoVinculacion: TipoVinculacion
  tipoFuncionario: String
  fechaNacimiento: String
  tituloProfesional: String
  genero: Genero
  tipoSangre: String
  estadoCivil: String
  discapacidad: Boolean
  discapacidadDetalles: String
  nombreImagen: String
  diasAFavor: Int
  horasAcumuladas: Int
  minutosAcumulados: Int
}

type Permiso {
  id: ID
  funcionario: ID
  periodo: ID
  horaSalida: String
  horasPermiso: Int
  minutosPermiso: Int
  descontado: Boolean
  motivo: String
  estado: Boolean
}

type TotalPermisos {
  totalPermisos: Int
  totalHoras: Int
  totalHorasSin: Int
  totalMinutos: Int
  totalMinutosSin: Int
  totalDias: Int
}

type Vacacion {
  id: ID
  funcionario: String
  fechaSalida: String
  fechaEntrada: String
  diasSolicitados: Int
  estado: Boolean
}

type Periodos {
  periodos: [Periodo]
  totalPeriodos: Int
}
type Periodo {
  id: ID
  nombre: String
  vigente: Boolean
  fechaInicio: String
  fechaFinal: String
}

enum TipoDocumento {
  CEDULA
  PASAPORTE
}
enum TipoVinculacion {
  PERMANENTE
  OCASIONAL
}
enum Genero {
  MASCULINO
  FEMENINO
}

type File {
  id: ID!
  path: String!
  filename: String!
  mimetype: String!
  encoding: String!
}

type Token {
  token: String!
}

type VacacionCompleta {
  vacaciones: [Vacacion]
  totalVacaciones: Int
  totalDiasDescontados: Int
}

type Contrato {
  id: ID
  funcionario: ID
  periodo: ID
  nombrePeriodo: String
  nombreArchivo: String
  tipoContrato: String
  contrato: Boolean
  nombramiento: Boolean
  fechaInicioActividades: String
}

type ContratoCompleto {
  contratos: [Contrato]
  totalContratos: Int
}

#inputs
input VacacionInput {
  funcionario: ID!
  periodo: ID!
  fechaSalida: String!
  fechaEntrada: String!
  diasSolicitados: Int!
}

input FuncionarioInput {
  id: ID
  cedula: String
  nombre: String
  segundoNombre: String
  apellido: String
  segundoApellido: String
  nacionalidad: String
  tipoVinculacion: TipoVinculacion
  tipoFuncionario: String
  fechaNacimiento: String
  tituloProfesional: String
  genero: Genero
  tipoSangre: String
  estadoCivil: String
  discapacidad: Boolean
  discapacidadDetalles: String
  nombreImagen: String
  diasAFavor: Int
}
input PermisoInput {
  id: ID
  funcionario: ID
  periodo: ID
  horaSalida: String
  horasPermiso: Int
  minutosPermiso: Int
  motivo: String
  estado: Boolean
}

input GuardarContratoInput {
  funcionario: ID!
  periodo: ID!
  nombrePeriodo: String!
  nombreArchivo: String!
  archivo: Upload!
  tipoContrato: String!
  contrato: Boolean
  nombramiento: Boolean
  fechaInicioActividades: String
}
type EmpleadosPorTipo {
  name: String
  numero: Int
}
type PorcentajeMF {
  genero: String
  porcentaje: Float
  value: Int
}
type EdadPromedio {
  genero: String
  fechas: [FechasNacimiento]
}
type FechasNacimiento {
  fecha: String
}
type MasPermisos {
  permisos: Int
  funcionario: [Funcionario]
}
type DiscapacidadFuncionario {
  porcentaje: Float
  total: Int
}
type Usuario {
  id: ID
  usuario: String
  nombre: String
  correo: String
}
input ActualizarUsuario {
  id: ID!
  nombre: String!
  usuario: String!
  correo: String
  nuevoPassword: String
}

type Query {
  #dashboard
  numeroEmpleadosPorTipo: [EmpleadosPorTipo]
  porcentajeHombreMujeres: [PorcentajeMF]
  edadPromedioMF: [EdadPromedio]
  masPermisos: [MasPermisos]
  tendenciaPermisos: [String]
  porcentajeFuncionarioDiscapacidad: [DiscapacidadFuncionario]

  #contratos
  obtenerContratos(funcionario: ID!, limite: Int, offset: Int): ContratoCompleto
  #periodos
  obtenerPeriodos(limite: Int, offset: Int): Periodos
  #vacaciones
  obtenerVacaciones(
    id: ID!
    idPeriodo: ID
    limite: Int
    offset: Int
  ): VacacionCompleta

  #permisos
  totalPermisos(id: ID!, idPeriodo: ID): TotalPermisos
  obtenerPermisos(id: ID!, idPeriodo: ID, limite: Int, offset: Int): [Permiso]
  #usuario
  obtenerUsuario: Usuario
  #subir imagenes
  mostrarImagen: [String]
  #Funcionarios
  obtenerFuncionario(cedula: String!): Funcionario
}

type Mutation {
  #recuperar
  recuperarPassword(correo: String!): String
  #usuario
  crearUsuario(usuario: String!, nombre: String!, password: String): String
  autenticarUsuario(email: String!, password: String!): Token
  actualizarUsuario(input: ActualizarUsuario!): String
  verificarPassword(id: ID!, password: String!): Boolean
  #contratos
  guardarContrato(input: GuardarContratoInput): String
  eliminarContrato(id: ID!, nombreArchivo: String!): String
  #periodo
  crearPeriodo(nombre: String, fechaInicio: String, fechaFinal: String): String
  hacerVigente(id: ID!): String
  eliminarPeriodo(id: ID!): String
  #vacaciones
  actualizarDiasHabiles(id: ID!, dias: Int, sumar: Boolean): String
  guardarVacacion(input: VacacionInput): String
  eliminarVacacion(id: ID!): String
  actualizarEstadoVacacion(id: ID, estado: Boolean): String
  #permisos
  descontarPermisos(
    funcionario: ID!
    periodo: ID!
    diasAFavor: Int
    horasAcumuladas: Int
    minutosAcumulados: Int
    dias: Int
    horas: Int
    minutos: Int
  ): String
  actualizarEstadoPermiso(id: ID, estado: Boolean): String
  crearPermiso(input: PermisoInput): String
  eliminarPermiso(id: ID!): String
  #funcionarios
  crearFuncionario(input: FuncionarioInput): String
  actualizarFuncionario(input: FuncionarioInput): String
  eliminarFuncionario(id: ID!): String
  #subir imagenes
  uploadFile(file: Upload!): Boolean
}`;