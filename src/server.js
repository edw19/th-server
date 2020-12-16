import express from 'express';
import { ApolloServer, AuthenticationError } from 'apollo-server-express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { typeDefs, resolvers } from './data/schema';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { Contratos } from './data/db';
// paquete para ccomprimir archivos de contratos
import zip from 'express-zip'



const app = express();

existsSync(path.join(__dirname, "./static/imagenes")) || mkdirSync(path.join(__dirname, "./static/imagenes"), { recursive: true })
existsSync(path.join(__dirname, "./static/contratos")) || mkdirSync(path.join(__dirname, "./static/contratos"), { recursive: true })

// Configuraciones 
const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true
}
app.set('port', process.env.PORT || 5000);
app.disable('x-powered-by');

// middlewares
app.use(cors(corsOptions))
app.use(cookieParser())
// app.use(body_parser.urlencoded({extended: true}))
app.use(express.urlencoded({ extended: true }))

// routes
app.post('/login', async (req, res) => {
    const { token } = req.body
    res.cookie('jwt', token, {
        httpOnly: true
        //secure: true, //on HTTPS
        //domain: 'example.com', //set your domain
    })
    res.send({
        success: true
    })
})
app.post('/logout', async (req, res) => {
    res.clearCookie('jwt')
    res.redirect('/')
});

app.get("/", (req, res) => {
    res.send("Sistema de administración de talento humano");
});

app.get('/contratos-funcionario', async (req, res) => {
    const result = await Contratos.find({ funcionario: req.query.funcionario, periodo: req.query.periodo }).exec();
    let archivos = []
    result.forEach(contrato => {
        archivos.push({ path: path.join(__dirname, `/static/contratos/${contrato.nombreArchivo}`), name: removeAccents(contrato.nombreArchivo) })
    })
    res.zip(archivos)
});
app.get('/todos-contratos', async (req, res) => {
    const result = await Contratos.find({ funcionario: req.query.funcionario }).exec();
    let archivos = []
    result.forEach(contrato => {
        archivos.push({ path: path.join(__dirname, `/static/contratos/${contrato.nombreArchivo}`), name: removeAccents(contrato.nombreArchivo) })
    })
    res.zip(archivos)
});
app.get('/todos-contratos-periodo', async (req, res) => {
    const result = await Contratos.find({ periodo: req.query.periodo }).exec();
    let archivos = []
    result.forEach(contrato => {
        archivos.push({ path: path.join(__dirname, `/static/contratos/${contrato.nombreArchivo}`), name: removeAccents(contrato.nombreArchivo) })
    })
    res.zip(archivos)
});



app.use('/imagenes', express.static(path.join(__dirname, './static/imagenes')));
app.use('/contratos', express.static(path.join(__dirname, './static/contratos')));
app.use('/formato', express.static(path.join(__dirname, './static/formato de registro de funcionarios.xlsx')));

// funcion para quitar accentos en javascript
const removeAccents = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function context({ req }) {
    const token = req.headers['authorization'];
    if (token) {
        try {
            const usuario = jwt.verify(token.replace('Bearer ', ''), process.env.MI_CODIGO_SECRETO)
            return usuario
        } catch (error) {
            throw new AuthenticationError(
                'no tienes un token de session, loggeate'
            )
        }
    }
}

async function formatError(e) {
    console.log(e.message)
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context,
    cors: false,
    playground: {
        settings: {
            "request.credentials": 'same-origin'
        }
    },
    formatError 
})


server.applyMiddleware({ app, cors: false })
export default app

