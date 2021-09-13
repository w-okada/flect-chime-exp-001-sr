```
$ npx create-react-app flect-chime-test-001-sr --template typescript
$ npm install amazon-chime-sdk-js
$ npm install @material-ui/core
$ npm install aws-sdk

$ openssl genrsa 2048 > server.key
$ openssl req -new -days 10000 -key server.key -out server.csr
$ openssl x509 -in server.csr -out server.crt -req -signkey server.key -days 10000

# # オレオレ認証局
# $ openssl genrsa 2048 > ca.key
# $ openssl req -new -key ca.key -subj "/CN=rootca" > ca.csr
# $ openssl x509 -req -in ca.csr -signkey ca.key -days 10000 -out ca.crt 
# $ openssl genrsa 2048 > server.key
# $ openssl req -new -key server.key  > server.csr
# $ openssl req -text -noout -in server.csr
# $ openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 10000 -out server.crt
```