const fs = require('fs');
const path = require('path');
const db = require('./supabaseClient');

//const USERS_FILE = path.join(__dirname, 'database', 'users.json');
//const SESSIONS_DIR = path.join(__dirname, 'sessions');
//const SETTINGS_DIR = path.join(__dirname, 'settings');

// Ensure users.json exists
//if (!fs.existsSync(USERS_FILE)) {
  //  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
//}

// Load users from JSON file/
//function loadUsers() {
  //  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
//}

// Save users to JSON file
//function saveUsers(users) {
  //  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
//}

// Add a new user
//async function addUser(userNumber) {
  //  let users = loadUsers();

    //if (users.includes(userNumber)) {
     //   return `User ${userNumber} is already registered.`;
    //}

    // Save to Supabase
    //let { data, error } = await db
      //  .from('users')
        //.insert([{ user_id: userNumber }]);

    //if (error) return `Failed to register in Supabase: ${error.message}`;

    // Save to JSON
    //users.push(userNumber);
    //saveUsers(users);

    // Create user session folder
    //const userFolder = path.join(SESSIONS_DIR, userNumber);
   // if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder);

    // Create user settings file
   // const userSettingsFile = path.join(SETTINGS_DIR, `${userNumber}.json`);
   // if (!fs.existsSync(userSettingsFile)) {
    //    fs.writeFileSync(userSettingsFile, JSON.stringify({}));
    //}

   // return `User ${userNumber} is now registered.`;
//}

// Get all registered users
//async function getUsers() {
  //  let users = loadUsers();

    //let { data, error } = await db.from('users').select('user_id');
    //if (!error && data) {
     //   const dbUsers = data.map(user => user.user_id);
      //  users = [...new Set([...users, ...dbUsers])]; // Merge unique users
    //}

//    return users;
//}

// Remove a user
//async function removeUser(userNumber) {
  //  let users = loadUsers();

    //if (!users.includes(userNumber)) {
      //  return `User ${userNumber} is not registered.`;
    //}

    // Remove from Supabase
   // await db.from('users').delete().eq('user_id', userNumber);

    // Remove from JSON
    //users = users.filter(user => user !== userNumber);
    //saveUsers(users);

    // Delete user session folder
    //const userFolder = path.join(SESSIONS_DIR, userNumber);
   // if (fs.existsSync(userFolder)) fs.rmSync(userFolder, { recursive: true });

    // Delete user settings file
    //const userSettingsFile = path.join(SETTINGS_DIR, `${userNumber}.json`);
    //if (fs.existsSync(userSettingsFile)) fs.unlinkSync(userSettingsFile);

    //return `User ${userNumber} has been removed.`;
//}

//module.exports = { addUser, getUsers, removeUser };