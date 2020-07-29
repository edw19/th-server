import express from 'express';
import { ApolloServer, AuthenticationError } from 'apollo-server-express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { typeDefs, resolvers } from './data/schema';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const app = express();

existsSync(path.join(__dirname, "./static/imagenes")) || mkdirSync(path.join(__dirname, "./static/imagenes"), {recursive: true})
existsSync(path.join(__dirname, "./static/contratos")) || mkdirSync(path.join(__dirname, "./static/contratos"), {recursive: true})

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

app.use('/imagenes', express.static(path.join(__dirname, './static/imagenes')));
app.use('/contratos', express.static(path.join(__dirname, './static/contratos')));


const context = async ({ req }) => {
    const token = req.cookies['jwt']
    if (typeof token != 'undefined') {
        try {
            const cliente = await jwt.verify(token, process.env.MI_CODIGO_SECRETO)
            return { cliente }
        } catch (error) {
            throw new AuthenticationError(
                'no tienes un token de session, loggeate'
            )
        }
    }
}

// async function formatError (e) {
//     console.log(e.message)
// }

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context,
    // formatError, 
    cors: false
})

server.applyMiddleware({ app, cors: false })
export default app

