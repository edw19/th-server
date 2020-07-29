require('dotenv').config({path: '.env'})
import app from './server'

async function main() {
    app.listen(app.get('port'), "127.0.0.1")
    console.log(`Servidor en on : http://localhost:${app.get('port')}/graphql`)
}

process.on('unhandledRejection', error => {
    console.log(error)
    process.exit(0)
})

main();