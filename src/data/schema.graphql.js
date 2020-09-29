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
  tituloProfesional: [TituloProfesional]
  genero: Genero
  tipoSangre: String
  estadoCivil: String
  discapacidad: Boolean
  discapacidadDetalles: String
  nombreImagen: String
  diasAFavor: Int
  horasAcumuladas: Int
  minutosAcumulados: Int
  fechaIngreso: String
  fechaSalida: String
  desvinculacion: Boolean
}

type TituloProfesional {
  nombre: String
  principal: Boolean
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
  motivo: String
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
  motivo: String!
  diasSolicitados: Int!
}

input TituloProfesionalInput {
  nombre: String!
  principal: Boolean
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
  tituloProfesional: [TituloProfesionalInput]
  genero: Genero
  tipoSangre: String
  estadoCivil: String
  discapacidad: Boolean
  discapacidadDetalles: String
  nombreImagen: String
  diasAFavor: Int
  horasAcumuladas: Int
  minutosAcumulados: Int
  fechaIngreso: String
  fechaSalida: String
  desvinculacion: Boolean
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
  valor: Int
}
type PorcentajeMF {
  genero: String
  porcentaje: Int
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
  rol: String
  nombre: String
  correo: String
}
input ActualizarUsuario {
  id: ID!
  nombre: String!
  rol : String!
  correo: String
  nuevoPassword: String
}

type Funcionarios {
  cedula: String
  nombre: String
  segundoNombre: String
  apellido: String
  segundoApellido: String
  diasAFavor: Int
  tipoFuncionario: String
  tipoVinculacion: String
  tituloProfesional: String
}

type Reporte {
  permisos: [Permiso]
  resultado: TotalPermisosReporte
}

type TotalPermisosReporte {
  totalPermisos: Int,
  totalPermisosEnHoras: Int,
  totalPermisosEnMinutos: Int,
  diasDescontados: Int
}

type SaldoVacacionesPermisos  {
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
  tituloProfesional: [TituloProfesional]
  genero: Genero
  tipoSangre: String
  estadoCivil: String
  discapacidad: Boolean
  discapacidadDetalles: String
  nombreImagen: String
  diasAFavor: Int
  horasAcumuladas: Int
  minutosAcumulados: Int
  fechaIngreso: String
  fechaSalida: String
  desvinculacion: Boolean
  permisos: Int
  vacaciones: Int
}

type Query {
  #todos contratos
  todosContratosFuncionario: Upload!
  #Reportes
  obtenerSaldoVacionesPermisosFuncionarios(periodo: ID, tipoFuncionario: String): [SaldoVacacionesPermisos]
  obtenerPermisosReporte(id: ID!, periodo: ID!): Reporte
  #obtenerusuario
  obtenerUsuarios: [Usuario]
  # obtener funcionarios
  obtenerFuncionarios: [Funcionarios]
  #dashboard
  numeroEmpleadosPorTipo: [EmpleadosPorTipo]
  porcentajeHombreMujeres: [PorcentajeMF]
  edadPromedioMF: [EdadPromedio]
  masPermisos: [MasPermisos]
  tendenciaPermisos: [String]
  porcentajeFuncionarioDiscapacidad: [DiscapacidadFuncionario]

  #contratos
  obtenerContratos(funcionario: ID!,periodo: ID!, limite: Int, offset: Int): ContratoCompleto
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

  #descontar Permisos Masivo
  descontarPermisosMasivo(idPeriodo: String!): String

  #recuperar
  recuperarPassword(correo: String!): String
  #usuario
  crearUsuario(rol: String!, nombre: String!, password: String!, correo: String!): String
  autenticarUsuario(email: String!, password: String!): Token
  actualizarUsuario(input: ActualizarUsuario!): String
  verificarPassword(id: ID!, password: String!): Boolean
  cambiarRolUsuario(id: ID!, rol: String!): String
  eliminarUsuario(id: ID!): String
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