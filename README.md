Amazon Chime SDK JS Super Resolution Experiment
===

# build
## install dependency
```
npm install
```

## generate configfile
To access AWS chime server, you should set aws credential. 

If you create config.js like this, the server will use it.
```
$ cat > config.js
module.exports = {
    accessKeyId:'AKIAZxxxxxxx',
    secretAccessKey:'WuN0xxxxxxx'
}
```

Otherewise, the server will use default credential which is defined in '~/.aws' or environmental variables.

Please refer to this page to get more infomation.
https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/setup-credentials.html

## build
```
$ npm run build
```

# Run

```
$ node server.js
```

Access to the http://localhost:8888 with your browser. 



