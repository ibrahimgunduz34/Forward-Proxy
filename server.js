const net = require('net');
const cluster = require('cluster');
const { cpus } = require('os');

const createCluster = () => {
  // const numberOfCpus = cpus().length;
  const numberOfCpus = 64;
  for (let i = 0; i < numberOfCpus; i++) {
    cluster.fork()
  }
}

const incomingConnectionHandler = (clientToProxySocket) => {
  console.log('Client Connected To Proxy');
  // We need only the data once, the starting packet
  clientToProxySocket.once('data', (data) => {
    // If you want to see the packet uncomment below
    // console.log(data.toString());

    let isTLSConnection = data.toString().indexOf('CONNECT') !== -1;

    // By Default port is 80
    let serverPort = 80;
    let serverAddress;
    if (isTLSConnection) {
      // Port changed if connection is TLS
      serverPort = data.toString()
                          .split('CONNECT ')[1].split(' ')[0].split(':')[1];;
      serverAddress = data.toString()
                          .split('CONNECT ')[1].split(' ')[0].split(':')[0];
    } else {
      serverAddress = data.toString().split('Host: ')[1].split('\r\n')[0];
    }

    console.log(serverAddress);

    let proxyToServerSocket = net.createConnection({
      host: serverAddress,
      port: serverPort
    }, () => {
      console.log('PROXY TO SERVER SET UP');
      if (isTLSConnection) {
        clientToProxySocket.write('HTTP/1.1 200 OK\r\n\n');
      } else {
        proxyToServerSocket.write(data);
      }

      clientToProxySocket.pipe(proxyToServerSocket);
      proxyToServerSocket.pipe(clientToProxySocket);

      proxyToServerSocket.on('error', (err) => {
        console.log('PROXY TO SERVER ERROR');
        console.log(err);
      });
      
    });
    clientToProxySocket.on('error', err => {
      console.log('CLIENT TO PROXY ERROR');
      console.log(err);
    });
  });
}

if (cluster.isMaster) {
  createCluster();
} else {
  const server = net.createServer();

  server.on('connection', incomingConnectionHandler);
  
  server.on('error', (err) => {
    console.log('SERVER ERROR');
    console.log(err);
    throw err;
  });
  
  server.on('close', () => {
    console.log('Client Disconnected');
  });
  
  server.listen(8124, () => {
    console.log('Server runnig at http://localhost:' + 8124);
  });
    
}

