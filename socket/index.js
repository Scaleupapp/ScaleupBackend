const io = require("socket.io")(8000, {
  cors: {
    origin: "http://localhost:4000",
  },
});
let users = [];

const addUser = (userId, socketId) => {
  !users.some((user) => user.userId === userId) && users.push({userId,socketId});
};
const removeUser =(socketId)=>{
  users===users.filter((user)=>user.socketId!==socketId)
}
const getUser = (userId) => {
  return users.find((user) => user.userId === userId);
};
console.log(users,'asdadadad');
io.on("connection", (socket) => {
  //when connect
  console.log("a user connected");
  socket.on('addUser',(userId)=>{
    console.log(userId,"useeradd")
    addUser(userId,socket.id)
    io.emit('getUsers',users)
  });
//send and get messages
  socket.on("sendMessage", ({ senderId, receiverId, text }) => {
    console.log(senderId,"sender");
    const user = getUser(receiverId);
    console.log(user,'asdadad');
    io.to(user?.socketId).emit("getMessage", {
      senderId,
      text,
    });
  });


  //when disconnect
  socket.on("disconnect", () => {
    console.log("user disconnnected");
    removeUser(socket.id)
    io.emit('getUsers',users)

  });
});
