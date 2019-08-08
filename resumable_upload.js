
class Resumable {
    constructor(path){
        // this._sendChunkAsync = this._sendChunkAsync.bind(this);

        var $ = this;
        $.files = [];
        $.defaults = {
            chunkSize:1*1024*1024,
            // chunkSize:10,
            simultaneousUploads:3,
            uploading:0,
            query:{},
            headers:{},
            uploadMethod: 'POST',
            testMethod: 'GET',
            target: path,
            permanentErrors:[400, 401, 403, 404, 409, 415, 500, 501],
            chunkFormat:'blob',
            typeParameterName: 'resumableType',
            extentionParameterName: 'resumableExtention',
            identifierParameterName: 'resumableIdentifier',
            fileNameParameterName: 'resumableFilename',
            currentChunksParameterName: 'resumableChunkNumber',
            totalChunksParameterName: 'resumableTotalChunks',
            totalSizeParameterName: 'resumableTotalSize',
            fileNameParameterName: 'resumableFilename'
        };
    }

    getIdentifier(name){
        return name.replace(/[^a-zA-Z ]/g, "").replace(' ', '');
    }

    processFile(file){

        var fileObj = {}

        fileObj['file'] = file;
        fileObj['identifier'] = this.getIdentifier(file.name);
        fileObj['name'] = file.name;
        fileObj['size'] = file.size;
        fileObj['type'] = file.type;
        fileObj['extention'] = file.name.split('.').pop();
        fileObj['isUploading'] = false;
        fileObj['isPaused'] = false;
        fileObj['currentChunk'] = 1;
        // fileObj['totalChunks'] = parseInt(file.size/ this.defaults['chunkSize']) + 1;
        fileObj['totalChunks'] = file.size % this.defaults['chunkSize'] == 0 ? parseInt(file.size/ this.defaults['chunkSize']) : parseInt(file.size/ this.defaults['chunkSize']) + 1;

        return fileObj;
    }

    addFile(file){
        var f = this.processFile(file);
        if(f == null){
            return null;
        }

        // Check if item already added to list
        for(var i = 0; i < this.files.length; i++){
            if(this.files[i]['identifier'] == f['identifier']){
                return null;
            }
        }
        this.files.push(f);
        return f['identifier'];
    }

    getFile(identifier){
        for(var i = 0; i < this.files.length; i++){
            if(this.files[i]['identifier'] == identifier){
                return this.files[i];
            }
        }
        return null;
    }


    // Currently not in use,
    // but switch case can be used other place to handle res status
    chunkResponse(query, status){
        console.log('cb');
        console.log(query.resumableIdentifier);
        console.log(status);
        var identifier = query.resumableIdentifier;
        // console.log(query);
        switch (status){
            case 'done':
                return 1;
        //     case 'chunkSuccess':
        //         return 1;
        //     case 'invalidQuery':
        //         return -1;
        //     case 'parseError':
        //         return -1;
        //     case 'illegalExt':
        //         return -1;
        //     case 'fileExists':
        //         return -1;
        //     case 'chunkExists':
        //         return -1;
        //     case 'processingError':
        //         return -1;
        //     case 'timeout':
        //         return -1;
        //     default:
        //         return -1;
        }
    }

    uploadFile(identifier, callback){
        var fileObj = this.getFile(identifier);
        fileObj['isUploading'] = true;

        this._sendChunkAsync(identifier, function(identifier, status){
            callback(identifier, status);
        });
    }

    pauseFile(identifier){
        var fileObj = this.getFile(identifier);
        fileObj['isUploading'] = false;
    }

    removeFile(identifier){
        for(var i = 0; i < this.files.length; i++){
            if(this.files[i]['identifier'] == identifier){
                this.files.splice(i, 1);
                return 1;
            }
        }
        return null;
    }

    createChunk(fileObj){

        var chunk_start = (fileObj['currentChunk'] - 1) * this.defaults['chunkSize'];
        var chunk_end = chunk_start + this.defaults['chunkSize'];

        var data = new FormData();

        var b = new Blob([fileObj['file']], {type : 'application/octet-stream'});
        var blob = b.slice(chunk_start, chunk_end, 'application/octet-stream');

        data.append('file', blob, fileObj['name']);

        return data;
    }

    _sendChunkAsync(identifier, _callback){
        var self = this;

        var fileObj = this.getFile(identifier);

        if(fileObj['isUploading'] == false){
            // console.log('item paused');
            return;
        }

        if(fileObj['currentChunk'] > fileObj['totalChunks']){

            return;
        }

        var buffer = this.createChunk(fileObj);

        var query = {
            [this.defaults['typeParameterName']]: fileObj['type'],
            [this.defaults['extentionParameterName']]: fileObj['extention'],
            [this.defaults['identifierParameterName']]: fileObj['identifier'],
            [this.defaults['fileNameParameterName']]: fileObj['name'],
            [this.defaults['currentChunksParameterName']]: fileObj['currentChunk'],
            [this.defaults['totalChunksParameterName']]: fileObj['totalChunks'],
            [this.defaults['totalSizeParameterName']]: fileObj['size']
            // [this.defaults['fileNameParameterName']]: fileObj['name']
        };


        // Map query parameters to string
        var params = '?';
        for(var k in query){
            if (query.hasOwnProperty(k)) {
                params = params + k.toString() + '=' + query[k].toString() + '&';
            }
        }

        // Remove the last "&" character
        params = params.slice(0, -1);

        var xhr = new XMLHttpRequest();

        xhr.open('POST', this.defaults['target'] + params, true);
        xhr.timeout = 10000; // timeout in ms, 10 seconds
        xhr.send(buffer);

        // TODO: check status more carefully here
        xhr.onload = function() {
            switch (xhr.statusText){
                case 'done':
                    return _callback(fileObj['identifier'], xhr.statusText);
                case 'chunkSuccess':
                    _callback(fileObj['identifier'], xhr.statusText);
                    break;
                // case 'invalidQuery':
                //     return -1;
                // case 'parseError':
                //     return -1;
                case 'illegalExt':
                    return _callback(fileObj['identifier'], xhr.statusText);
                case 'fileExists':
                    self.removeFile(fileObj['identifier']);
                    return _callback(fileObj['identifier'], xhr.statusText);
                // case 'chunkExists':
                //     return -1;
                // case 'processingError':
                //     return -1;
                // case 'timeout':
                //     return -1;
                default:
                    break;
                    // return -1;
                    // continue;
            }
            // console.log(xhr.statusText);
            if(xhr.statusText == 'fileExists'){
                return _callback(fileObj['identifier'], xhr.statusText);
            }
            if(fileObj['currentChunk'] < fileObj['totalChunks']){

                // Send status
                _callback(fileObj['identifier'], xhr.statusText);

                // Update current chunk
                fileObj['currentChunk'] += 1;

                self._sendChunkAsync(identifier, _callback);
            } else{
                _callback(fileObj['identifier'], xhr.statusText);
            }
        }

        xhr.ontimeout = function(){
            // callback(query, 'timeout');
            return -1;
        }

        // console.log('sending chunk ' + query[this.defaults['currentChunksParameterName']]);
    }

}
