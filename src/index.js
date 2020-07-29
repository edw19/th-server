require('dotenv').config({path: 'variables.env'})
import app from './server'

async function main() {
    await app.listen(app.get('port'))
    console.log("otro log")
    console.log(`Servidor en : http://localhost:${app.get('port')}/graphql`)
}

process.on('unhandledRejection', error => {
    console.log(error)
    process.exit(0)
})

main();