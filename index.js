const express = require('express')
const path = require('path');
const formidable = require('formidable')
const fs = require('fs-extra')

var resumable = require('./resumable-node.js')('./temp/resumable/');

const app = express();
const port = 3000;

const TEMP_DIR = path.join(__dirname + '/temp');
const DST_DIR = path.join(__dirname + '/movies');

const ALLOWED_EXTENTIONS = [
    'rtf',
    'png',
    'jpg',
    'NEF',
    'mpeg',
    'mp4',
    'm4v',
    'srt',
    'json',
    'txt'
];

// Create temp_directory if not exists
if(!fs.existsSync(TEMP_DIR)){
    fs.mkdirSync(TEMP_DIR);
}

// Create movie_directory if not exists
if(!fs.existsSync(DST_DIR)){
    fs.mkdirSync(DST_DIR);
}

app.get('/testconnection', (req, res) => res.sendStatus(200))
app.post('/testconnection', function(req, res){
    console.log(req);
    return res.sendStatus(200);

    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files){
        // console.log(files.file.name);

        // console.log(fields);
        console.log(files);
        // return res.sendStatus(200);

        var data = fs.readFileSync(files.file.path);
        fs.writeFileSync('./received/' + req.query.resumableChunkNumber, data);
        // console.log(JSON.parse(data));

    });

    return res.sendStatus(200);
});

app.get('/index/', (req, res) => res.sendFile(path.join(__dirname + '/index.html')))
app.get('/upload/', (req, res) => res.sendFile(path.join(__dirname + '/upload.html')))


// TODO
// Need to work on better feedback to client
// Integrity check of uploaded file
app.post('/upload/new1/', function(req, res){
    console.log(req.query)

    var form = new formidable.IncomingForm();

    form.parse(req, function(err, fields, files) {
        // f = files.file
        // console.log(f)

        resumable.post(fields, files, function(status, filename, original_filename, identifier){
            console.log('POST', status, original_filename, identifier);

            if(status == 'partly_done'){
                res.send(status);
            } else if (status == 'done') {
                temp_path = './temp/' + req.query.resumableFilename

                // TODO: Could implement integrity check! Hash of file sent together with each chunk,
                // then compare with uploaded file after
                // Merge all chunks here
                if(!fs.existsSync(temp_path)){
                    console.log('merging')
                    var stream = fs.createWriteStream('./temp/' + req.query.resumableFilename);
                    resumable.write(identifier, stream);

                    // Delete temporary files
                    stream.on('finish', function(){
                        console.log('clean ' + identifier)
                        resumable.clean(identifier)
                        res.send(status)
                    });
                }
                else {
                    res.send(status)
                }
            } else if (status == 'invalid_resumable_request') {
                console.log('pause')
            }
        });
    });
})

app.get('/merge/', function(req,res){

    var stream = fs.createWriteStream('./temp/test.mp4');
    resumable.write('791140913-LykkelandS01E01mp4', stream);
    stream.on('data', function(data){
        console.log('data')
    });
    stream.on('end', function(){
        console.log('end')
    });
    res.sendStatus(200)
});


// Update this function later, to sort by file extention etc
function getFileLocation(name, extention){
    return path.join(DST_DIR, name);
}

// Handle uploads resumable
app.post('/upload/new/', function(req, res){

    console.log(req.query);
    // TODO: Validate query fields before uploaing
    // res.statusMessage('invalidQuery');
    // return res.sendStatus(400);

    var form = new formidable.IncomingForm();

    // Parse multipart body
    form.parse(req, function(err, fields, files) {
        // console.log(files);
        if (err) {
            console.log('Parse error');
            res.statusMessage = 'parseError';
            return res.sendStatus(400);
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
            console.log('Illegal file extention');
            res.statusMessage = 'illegalExt';
            return res.sendStatus(400)
        }
        console.log(TEMP_DIR);
        console.log(req.query.resumableIdentifier);
        const temp_path_dir = path.join(TEMP_DIR, req.query.resumableIdentifier)
        const temp_path = path.join(TEMP_DIR, req.query.resumableIdentifier, req.query.resumableChunkNumber)

        // Check if file already is uploaded
        var dest_path = getFileLocation(req.query.resumableFilename, req.query.resumableExtention);
        console.log(dest_path);
        if(fs.existsSync(dest_path)){
            console.log('File already exists on server. Use update flag to re-upload');
            // res.setHeader('stat', 'exists');
            res.statusMessage = 'fileExists';
            return res.sendStatus(400);
        }

        // Check if exist in temp. Look for unique id
        // If exist in temp, check if seq exists in tempfolder
        if(fs.existsSync(temp_path)){
            console.log('Chunk already uploaded');
            res.statusMessage = 'chunkExists';
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


        // // TODO: Could implement integrity check! Hash of file sent together with each chunk,
        // // then compare with uploaded file after
        // // Merge all chunks here
        // if(!fs.existsSync(temp_path)){
        //     console.log('merging')
        //     var stream = fs.createWriteStream('./temp/' + req.query.resumableFilename);
        //     resumable.write(identifier, stream);
        //
        //     // Delete temporary files
        //     stream.on('finish', function(){
        //         console.log('clean ' + identifier)
        //         resumable.clean(identifier)
        //         res.send(status)
        //     });
        // }
        // else {
        //     res.send(status)
        // }

        // Last seq, merge items
        const final = path.join(DST_DIR, req.query.resumableFilename)
        if (req.query.resumableChunkNumber == req.query.resumableTotalChunks){
            var files = fs.readdirSync(temp_path_dir);
            // console.log(idx)
            // console.log(files[idx])
            for(var i = 1; i < files.length + 1; i++){
                // console.log(files[i]);
                // console.log(i)
                s = i.toString()
                var idx = files.indexOf(s);
                // console.log(s)
                // var idx = files.indexOf(s);
                // console.log(idx)
                // console.log(s)
                // console.log(idx)
                f = files[idx];
                // console.log(f)

                // f = files[idx];
                //
                // console.log(f)
                //
                console.log(temp_path_dir);
                var data = fs.readFileSync(path.join(temp_path_dir, f));
                fs.appendFileSync(final, data);
            }

            // Check if all data got sucessfully transferred
            const stats = fs.statSync(final);
            const fileSizeInBytes = stats.size;
            console.log(fileSizeInBytes);
            console.log(req.query.resumableTotalSize)
            if(fileSizeInBytes == req.query.resumableTotalSize){
                console.log('success')
                // Clean up temp folder
                fs.removeSync(temp_path_dir);
                res.statusMessage = 'done';
                return res.sendStatus(200)
            }
            else{
                console.log('Clean up error');
                res.statusMessage = 'processingError';
                return res.sendStatus(400)
            }
        }

        res.statusMessage = 'chunkSuccess';
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

// Future ideas:

// Return a json with all movies uploaded and containing data like formats, subtitles, trailer etc
// Might be a better to store this data in a database and not scan through file system every time
// app.get('all_movies_on_server')

// Return disk usage on server, and free space left. Client can use to keep track/ check regularly.
// Also upload should be denied when not enough space left
// app.get('disk_usage')

// User account data:
// configure server ip address



app.listen(port, () => console.log(`Server listening on port ${port}!`))
