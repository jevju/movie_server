const express = require('express')
const app = express()
const path = require('path');
var formidable = require('formidable')

const fs = require('fs-extra')
const port = 3000

const TEMP_DIR = path.join(__dirname + '/temp')
const MOVIE_DIR = path.join(__dirname + '/movies')

ALLOWED_EXTENTIONS = [
    'png',
    'jpg',
    'NEF',
    'mpeg',
    'mp4'
]

// Create temp_directory if not exists
if(!fs.existsSync(TEMP_DIR)){
    fs.mkdirSync(TEMP_DIR);
}

// Create movie_directory if not exists
if(!fs.existsSync(MOVIE_DIR)){
    fs.mkdirSync(MOVIE_DIR);
}

app.get('/upload/', (req, res) => res.sendFile(path.join(__dirname + '/index.html')))

// Handle uploads through Resumable.js
app.post('/upload/new/', function(req, res){

    var form = new formidable.IncomingForm();

    // Parse multipart body
    form.parse(req, function(err, fields, files) {
        if (err) {
            return res.sendStatus(400)
        }

        f = files.file

        // Evaluate file extention
        var ext = f.name.split('.').pop();

        allowed = false;

        for(var i = 0; i < ALLOWED_EXTENTIONS.length; i++){
            if(ext == ALLOWED_EXTENTIONS[i]){
                allowed = true;
                break;
            }
        }

        if(allowed == false){
            // Illegal file extention
            return res.sendStatus(400)
        }

        const temp_path_dir = path.join(TEMP_DIR, req.query.resumableIdentifier)
        const temp_path = path.join(TEMP_DIR, req.query.resumableIdentifier, req.query.resumableChunkNumber)

        // Check if exist in temp. Look for unique id
        // If exist in temp, check if seq exists in tempfolder
        if(fs.existsSync(temp_path)){
            return res.sendStatus(400)
        }

        // create tempfolder if not exists
        const t = path.join(TEMP_DIR, req.query.resumableIdentifier)
        if(!fs.existsSync(t)){
            fs.mkdirSync(t);
        }

        // TODO:
        // Check if exists in fs, if exists possible to re-upload with update flag
        // if(temp_path == ''){
        //
        //     //if find, Return -- file exists
        //
        //     // If not,
        // }

        // Read file from stream
        var data = fs.readFileSync(f.path);
        // Write stream to temp dir
        fs.writeFileSync(path.join(temp_path), data)

        // Last seq, merge items
        const final = path.join(MOVIE_DIR, req.query.resumableFilename)
        if (req.query.resumableChunkNumber == req.query.resumableTotalChunks){
            var files = fs.readdirSync(temp_path_dir);
            for(var i = 0; i < files.length; i++){
                var data = fs.readFileSync(path.join(temp_path_dir, files[i]));
                fs.appendFileSync(final, data);
            }

            // Check if all data got sucessfully transferred
            const stats = fs.statSync(final);
            const fileSizeInBytes = stats.size;
            if(fileSizeInBytes == req.query.resumableTotalSize){
                console.log('success')
                // Clean up temp folder
                fs.removeSync(temp_path_dir);
                return res.sendStatus(200)
            }
            else{
                return res.sendStatus(400)
            }
        }

        return res.sendStatus(200)
    });
});



// Handle status checks on chunks through Resumable.js
app.get('/upload/new/', function(req, res){
    resumable.get(req, function(status, filename, original_filename, identifier){
        console.log('GET', status);
        res.send((status == 'found' ? 200 : 404), status);
    });
});


app.get('*', (req, res) => {
    // console.log(req.url)
    res.sendFile(path.join(__dirname + req.url))
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
