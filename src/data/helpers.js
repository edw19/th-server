import { Permisos, Funcionario } from './db'
import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;
export const totalPermisosFuncion = async (id, idPeriodo) => {
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
                motivo: "Asuntos Personales",
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
    // console.log(resultado)
    // console.log(acumulados)
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
    } else {
        TotalPermisos.totalHoras = horas

    }
    return TotalPermisos;
}
export const totalPermisosReportes = async (id, idPeriodo) => {
    const numeroDePermisos = await Permisos.countDocuments({
        funcionario: id,
        periodo: idPeriodo,
        descontado: true,
        estado: true
    });
    const diasDescontados = await Permisos.aggregate([
        {
            $match: {
                funcionario: ObjectId(id),
                periodo: ObjectId(idPeriodo),
                motivo: 'Asuntos Personales'
            },
        },
        {
            $group: {
                _id: "$funcionario",
                totalHoras: { $sum: "$horasPermiso" },
                totalMinutos: { $sum: "$minutosPermiso" },
                otros: { $sum: "$motivo" },
            },
        },
    ]);

    const totalPorMotivo = [
        {
            motivo: "Asuntos Laborales",
            valor: 0
        },
        {
            motivo: "Asuntos Personales",
            valor: 0
        },
        {
            motivo: "Calamidad Doméstica",
            valor: 0
        },
        {
            motivo: "Enfermedad",
            valor: 0
        },
        {
            motivo: "Estudios Regulares",
            valor: 0
        },
        {
            motivo: "Otros",
            valor: 0
        },
    ]

    for (let index = 0; index < totalPorMotivo.length; index++) {
        const res = await Permisos.aggregate([
            {
                $match: {
                    funcionario: ObjectId(id),
                    periodo: ObjectId(idPeriodo),
                    motivo: totalPorMotivo[index].motivo
                },
            }
        ]);
        totalPorMotivo[index].valor = Object.keys(res).length
    };


    const resultado = await Permisos.aggregate([
        {
            $match: {
                funcionario: ObjectId(id),
                estado: true,
                descontado: true,
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
        totalHoras = resultado[0].totalHoras;
        totalMinutos = resultado[0].totalMinutos;
    }

    const TotalPermisos = {
        totalPermisos: numeroDePermisos,
        totalPermisosEnHoras: totalHoras,
        totalPermisosEnMinutos: totalMinutos,
        diasDescontados: 0,
        totalPorMotivo
    };

    let dias = 0;

    if (Object.keys(diasDescontados).length === 0) return TotalPermisos;

    if (diasDescontados[0].totalHoras >= 8) {
        dias = Math.trunc(diasDescontados[0].totalHoras / 8);
        if (dias > 0) {
            TotalPermisos.diasDescontados = dias;
        }
    }
    return TotalPermisos;
}
