This repo holds the infrastructure that lets the gyroscope sensor communicate with a local and remote server.

The `remoteserver.js` runs on a remote machine (currently aws instance at http://3.72.45.118/)

The `localserver.js` runs on the same local network that the gyroscope is connected to and receives its input through OSC data.

The remote and local servers communicate over an SSH tunnel forwarding a tcp connection on port 1025 & 1337

## Set up

On the local machine:

- clone repo
- npm install
- connect to sensor ethernet (INERTIA) and internet (TODO: make sure we can do both at the same time)
- set up ssh tunnel to remote machine `ssh -N -L 1025:127.0.0.1:1337 {NAME}@{REMOTEMACHINEIP}
- `node localserver.js`

On the remote machine:

- clone repo
- npm install
- `node remoteserver.js`
