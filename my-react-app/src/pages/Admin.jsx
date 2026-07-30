import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";

// Rank options used in the Register and Update User forms
const rankOptions = [
  "Recruit",
  "Private",
  "Lance Corporal",
  "Corporal",
  "Specialist Cadet, Junior Term",
  "Specialist Cadet, Senior Term",
  "Sergeant 1",
  "Sergeant 2",
  "Sergeant 3",
  "Warrant Officer 1",
  "Warrant Officer 2",
  "Officer Cadet, Junior Term",
  "Officer Cadet, Senior Term",
  "2nd Lieutenant",
  "Lieutenant",
  "Captain",
  "Major",
  "Lieutenant Colonel",
  "Colonel",
  "Assistant Commissioner",
  "Senior Assistant Commissioner",
  "Deputy Commissioner",
  "Commissioner",
];

function Admin() {
  // Store users and admins fetched from Firebase
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [officialIPPTResults, setOfficialIPPTResults] = useState([]);

  // Default empty form values for registering or updating a user
  const emptyUserForm = {
    firstName: "",
    lastName: "",
    email: "",
    dob: "",
    gender: "Male",
    address: "",
    password: "",
    rank: "Recruit",
    role: "Personnel",
    unit: "",
    commanderID: "",
  };

  // Store form data for registering a new user
  const [newUser, setNewUser] = useState(emptyUserForm);

  // Store selected user and form data for updating an existing user
  const [selectedUserId, setSelectedUserId] = useState("");
  const [updateUser, setUpdateUser] = useState(emptyUserForm);

  // Store which commander is selected in the overview dropdown
  const [selectedCommanderViewId, setSelectedCommanderViewId] = useState("all");

  // Fetch all registered users from Firebase
  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));

      const usersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to load users from Firebase.");
    }
  };

  // Fetch all admin accounts from Firebase
  const fetchAdmins = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "admin"));

      const adminsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAdmins(adminsData);
    } catch (error) {
      console.error("Error fetching admins:", error);
      alert("Failed to load admins from Firebase.");
    }
  };
  const fetchOfficialIPPTResults = async () => {
    try {
      const querySnapshot = await getDocs(
        collection(db, "officialIPPT")
      );

      const resultsData = querySnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      resultsData.sort((a, b) => {
        return getOfficialResultDate(b) - getOfficialResultDate(a);
      });

      setOfficialIPPTResults(resultsData);
    } catch (error) {
      console.error("Error fetching official IPPT results:", error);
      alert("Failed to load official IPPT results.");
    }
  };

  // Load users and admins when the Admin page first opens
  useEffect(() => {
    fetchUsers();
    fetchAdmins();
    fetchOfficialIPPTResults();
  }, []);

  // Separate commanders from all users
  const commanders = users.filter((user) => user.role === "Commander");

  // Separate personnel from all users
  const personnelUsers = users.filter((user) => user.role === "Personnel");

  // Get the commander's full name using the stored commanderID
  const getCommanderName = (commanderID) => {
    if (!commanderID) return "-";

    const commander = commanders.find(
      (user) => user.id === commanderID || user.userID === commanderID
    );

    if (!commander) return "-";

    return `${commander.firstName || commander.name || "-"} ${
      commander.lastName || ""
    }`;
  };

  // Find all personnel assigned to a specific commander
  const getPersonnelUnderCommander = (commander) => {
    return personnelUsers.filter((personnel) => {
      const commanderUserId = commander.userID || commander.id;

      return (
        personnel.commanderID === commanderUserId ||
        personnel.commanderID === commander.id ||
        (!personnel.commanderID && personnel.unit === commander.unit)
      );
    });
  };

  const getLatestOfficialIPPT = (person) => {
    const personUserID = person.userID || person.id;

    const matchingRecords = officialIPPTResults.filter((record) => {
      return (
        record.userID === personUserID ||
        record.userID === person.id ||
        record.personnelDocID === person.id ||
        record.personnelDocID === personUserID ||
        record.responderDocID === person.id ||
        record.responderDocID === personUserID
      );
    });

    if (matchingRecords.length === 0) {
      return null;
    }

    const sortedRecords = [...matchingRecords].sort(
      (a, b) =>
        getOfficialResultDate(b) - getOfficialResultDate(a)
    );

    return sortedRecords[0];
  };

  // Update register form values when the admin types
  const handleUserChange = (e) => {
    const { name, value } = e.target;

    setNewUser({
      ...newUser,
      [name]: value,
    });
  };

  // Update edit form values when the admin types
  const handleUpdateUserChange = (e) => {
    const { name, value } = e.target;

    setUpdateUser({
      ...updateUser,
      [name]: value,
    });
  };

  // Load selected user details into the update form
  const handleSelectUserToUpdate = (e) => {
    const userId = e.target.value;
    setSelectedUserId(userId);

    const selectedUser = users.find((user) => user.id === userId);

    if (selectedUser) {
      const nameParts = selectedUser.name?.split(" ") || [];

      setUpdateUser({
        firstName: selectedUser.firstName || nameParts[0] || "",
        lastName: selectedUser.lastName || nameParts.slice(1).join(" ") || "",
        email: selectedUser.email || "",
        dob: selectedUser.dob || "",
        gender: selectedUser.gender || "Male",
        address: selectedUser.address || "",
        password: selectedUser.password || "",
        rank: selectedUser.rank || "Recruit",
        role:
          selectedUser.role === "Personnel"
            ? "Personnel"
            : selectedUser.role || "Personnel",
        unit: selectedUser.unit || "",
        commanderID: selectedUser.commanderID || "",
      });
    } else {
      setUpdateUser(emptyUserForm);
    }
  };

  // Check that all required user fields are filled in
  const validateUserForm = (user) => {
    if (
      !user.firstName ||
      !user.lastName ||
      !user.email ||
      !user.dob ||
      !user.gender ||
      !user.address ||
      !user.password ||
      !user.rank ||
      !user.role ||
      !user.unit
    ) {
      return false;
    }

    // Personnel must be assigned to a commander
    if (user.role === "Personnel" && !user.commanderID) {
      return false;
    }

    return true;
  };

  // Register a new user into Firebase
  const handleRegisterUser = async (e) => {
    e.preventDefault();

    if (!validateUserForm(newUser)) {
      alert("Please fill in all user fields.");
      return;
    }

    try {
      const fullName = `${newUser.firstName} ${newUser.lastName}`;

      // Prepare user data before saving into Firebase
      const userToSave = {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        name: fullName,
        email: newUser.email,
        dob: newUser.dob,
        gender: newUser.gender,
        address: newUser.address,
        password: newUser.password,
        rank: newUser.rank,

        role: newUser.role,
        appRole:
          newUser.role === "Personnel" ? "Personnel" : newUser.role,

        unit: newUser.unit,
        commanderID:
          newUser.role === "Commander" ? "" : newUser.commanderID,

        ippt: "N/A",
        readiness: 0,
        userID: "",

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "users"), userToSave);

      // Save the generated Firebase document ID as userID
      await updateDoc(doc(db, "users", docRef.id), {
        userID: docRef.id,
        commanderID:
          newUser.role === "Commander"
            ? docRef.id
            : newUser.commanderID,
      });

      // If the new user is a commander, also save them into the commander collection
      if (newUser.role === "Commander") {
        await addDoc(collection(db, "commander"), {
          commanderID: docRef.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          name: fullName,
          email: newUser.email,
          role: "Commander",
          unit: newUser.unit,
          rank: newUser.rank,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setNewUser(emptyUserForm);
      await fetchUsers();

      alert("User registered successfully.");
    } catch (error) {
      console.error("Error registering user:", error);
      alert("Failed to register user.");
    }
  };

  // Update an existing user in Firebase
  const handleUpdateUser = async (e) => {
    e.preventDefault();

    if (!selectedUserId) {
      alert("Please select a user to update.");
      return;
    }

    if (!validateUserForm(updateUser)) {
      alert("Please fill in all update fields.");
      return;
    }

    try {
      const fullName = `${updateUser.firstName} ${updateUser.lastName}`;
      const userRef = doc(db, "users", selectedUserId);

      await updateDoc(userRef, {
        firstName: updateUser.firstName,
        lastName: updateUser.lastName,
        name: fullName,
        email: updateUser.email,
        dob: updateUser.dob,
        gender: updateUser.gender,
        address: updateUser.address,
        password: updateUser.password,
        rank: updateUser.rank,

        role: updateUser.role,
        appRole:
          updateUser.role === "Personnel"
            ? "Personnel"
            : updateUser.role,

        unit: updateUser.unit,
        commanderID:
          updateUser.role === "Personnel"
            ? updateUser.commanderID
            : "",

        updatedAt: serverTimestamp(),
      });

      setSelectedUserId("");
      setUpdateUser(emptyUserForm);

      await fetchUsers();

      alert("User updated successfully.");
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user.");
    }
  };

  // Delete a user from Firebase
  const handleDeleteUser = async (userId, userName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${userName}?`
    );

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "users", userId));

      if (selectedUserId === userId) {
        setSelectedUserId("");
        setUpdateUser(emptyUserForm);
      }

      await fetchUsers();

      alert("User deleted successfully.");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user.");
    }
  };

  return (
    <main className="admin-page">
      <section className="admin-container">
        <div className="admin-header">
          <h1>Admin Management</h1>
          <p>Register personnel, admins, and commanders.</p>

          <Link to="/ippt-results" className="admin-link-btn">
            Manage IPPT Results
          </Link>
        </div>

        <section className="admin-summary">
          <div className="summary-card">
            <h3>Total Users</h3>
            <p>{users.length + admins.length}</p>
          </div>

          <div className="summary-card">
            <h3>Personnel</h3>
            <p>
              {users.filter((user) => user.role === "Personnel").length}
            </p>
          </div>

          <div className="summary-card">
            <h3>Commanders</h3>
            <p>
              {users.filter((user) => user.role === "Commander").length}
            </p>
          </div>

          <div className="summary-card">
            <h3>Admins</h3>
            <p>{admins.length}</p>
          </div>
        </section>

        <section className="admin-grid">
          <form
            className="admin-card admin-register-card"
            onSubmit={handleRegisterUser}
          >
            <h2>Register User</h2>

            <div className="admin-form-grid">
              <div>
                <label>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={newUser.firstName}
                  onChange={handleUserChange}
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={newUser.lastName}
                  onChange={handleUserChange}
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={newUser.email}
                  onChange={handleUserChange}
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label>Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={newUser.dob}
                  onChange={handleUserChange}
                />
              </div>

              <div>
                <label>Gender</label>
                <select
                  name="gender"
                  value={newUser.gender}
                  onChange={handleUserChange}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={newUser.password}
                  onChange={handleUserChange}
                  placeholder="Enter password"
                />
              </div>

              <div>
                <label>Rank</label>
                <select
                  name="rank"
                  value={newUser.rank}
                  onChange={handleUserChange}
                >
                  {rankOptions.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Role</label>
                <select
                  name="role"
                  value={newUser.role}
                  onChange={handleUserChange}
                >
                  <option value="Personnel">Personnel</option>
                  <option value="Admin">Admin</option>
                  <option value="Commander">Commander</option>
                </select>
              </div>

              <div>
                <label>Unit / Team</label>
                <select
                  name="unit"
                  value={newUser.unit}
                  onChange={handleUserChange}
                >
                  <option value="">Select unit/team</option>
                  <option value="Firefighter">Firefighter</option>
                  <option value="Paramedic">Paramedic</option>
                </select>
              </div>

              {newUser.role === "Personnel" && (
                <div>
                  <label>Assigned Commander</label>
                  <select
                    name="commanderID"
                    value={newUser.commanderID}
                    onChange={handleUserChange}
                  >
                    <option value="">Select commander</option>

                    {commanders.map((commander) => (
                      <option
                        key={commander.id}
                        value={commander.userID || commander.id}
                      >
                        {commander.firstName ||
                          commander.name ||
                          "-"}{" "}
                        {commander.lastName || ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={newUser.address}
                  onChange={handleUserChange}
                  placeholder="Enter address"
                />
              </div>
            </div>

            <button type="submit">Register User</button>
          </form>

          <form
            className="admin-card admin-register-card update-user-card"
            onSubmit={handleUpdateUser}
          >
            <h2>Update User</h2>

            <label>Select User</label>
            <select
              value={selectedUserId}
              onChange={handleSelectUserToUpdate}
            >
              <option value="">Select user to update</option>

              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName || user.name || "-"}{" "}
                  {user.lastName || ""} - {user.role || "-"}
                </option>
              ))}
            </select>

            <div className="admin-form-grid">
              <div>
                <label>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={updateUser.firstName}
                  onChange={handleUpdateUserChange}
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={updateUser.lastName}
                  onChange={handleUpdateUserChange}
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={updateUser.email}
                  onChange={handleUpdateUserChange}
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label>Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={updateUser.dob}
                  onChange={handleUpdateUserChange}
                />
              </div>

              <div>
                <label>Gender</label>
                <select
                  name="gender"
                  value={updateUser.gender}
                  onChange={handleUpdateUserChange}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={updateUser.password}
                  onChange={handleUpdateUserChange}
                  placeholder="Enter password"
                />
              </div>

              <div>
                <label>Rank</label>
                <select
                  name="rank"
                  value={updateUser.rank}
                  onChange={handleUpdateUserChange}
                >
                  {rankOptions.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Role</label>
                <select
                  name="role"
                  value={updateUser.role}
                  onChange={handleUpdateUserChange}
                >
                  <option value="Personnel">Personnel</option>
                  <option value="Admin">Admin</option>
                  <option value="Commander">Commander</option>
                </select>
              </div>

              <div>
                <label>Unit / Team</label>
                <select
                  name="unit"
                  value={updateUser.unit}
                  onChange={handleUpdateUserChange}
                >
                  <option value="">Select unit/team</option>
                  <option value="Firefighter">Firefighter</option>
                  <option value="Paramedic">Paramedic</option>
                </select>
              </div>

              {updateUser.role === "Personnel" && (
                <div>
                  <label>Assigned Commander</label>
                  <select
                    name="commanderID"
                    value={updateUser.commanderID}
                    onChange={handleUpdateUserChange}
                  >
                    <option value="">Select commander</option>

                    {commanders.map((commander) => (
                      <option
                        key={commander.id}
                        value={commander.userID || commander.id}
                      >
                        {commander.firstName ||
                          commander.name ||
                          "-"}{" "}
                        {commander.lastName || ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={updateUser.address}
                  onChange={handleUpdateUserChange}
                  placeholder="Enter address"
                />
              </div>
            </div>

            <button type="submit">Update User</button>
          </form>
        </section>

        <section className="admin-card user-list">
          <h2>Registered Users</h2>

          {users.length === 0 ? (
            <p className="empty-table-text">
              No registered users found.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Email</th>
                  <th>Date of Birth</th>
                  <th>Gender</th>
                  <th>Address</th>
                  <th>Rank</th>
                  <th>Role</th>
                  <th>Unit</th>
                  <th>Commander</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.firstName || user.name || "-"}</td>
                    <td>{user.lastName || "-"}</td>
                    <td>{user.email || "-"}</td>
                    <td>{user.dob || "-"}</td>
                    <td>{user.gender || "-"}</td>
                    <td>{user.address || "-"}</td>
                    <td>{user.rank || "-"}</td>
                    <td>{user.role || "-"}</td>
                    <td>{user.unit || "-"}</td>
                    <td>{getCommanderName(user.commanderID)}</td>
                    <td>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() =>
                          handleDeleteUser(
                            user.id,
                            user.name ||
                            `${user.firstName || ""} ${user.lastName || ""
                            }`
                          )
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-card commander-personnel-section">
          <h2>Commander & Personnel Overview</h2>

          {commanders.length === 0 ? (
            <p className="empty-table-text">
              No commanders found.
            </p>
          ) : (
            <>
              <div className="commander-filter-box">
                <label>Select Commander</label>

                <select
                  value={selectedCommanderViewId}
                  onChange={(e) =>
                    setSelectedCommanderViewId(e.target.value)
                  }
                >
                  <option value="all">All Commanders</option>

                  {commanders.map((commander) => (
                    <option key={commander.id} value={commander.id}>
                      {commander.firstName || commander.name || "-"}{" "}
                      {commander.lastName || ""} -{" "}
                      {commander.rank || "Commander"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="commander-personnel-grid">
                {(selectedCommanderViewId === "all"
                  ? commanders
                  : commanders.filter(
                    (commander) =>
                      commander.id === selectedCommanderViewId
                  )
                ).map((commander) => {
                  const assignedPersonnel =
                    getPersonnelUnderCommander(commander);

                  return (
                    <div
                      className="commander-personnel-card"
                      key={commander.id}
                    >
                      <div className="commander-personnel-header">
                        <div>
                          <h3>
                            {commander.firstName ||
                              commander.name ||
                              "-"}{" "}
                            {commander.lastName || ""}
                          </h3>

                          <p>{commander.rank || "Commander"}</p>
                        </div>
                      </div>

                      <h4>Personnel Under Commander</h4>

                      {assignedPersonnel.length === 0 ? (
                        <p className="empty-table-text">
                          No personnel assigned to this commander.
                        </p>
                      ) : (
                        <table className="mini-user-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Rank</th>
                              <th>Unit</th>
                              <th>IPPT</th>
                            </tr>
                          </thead>

                          <tbody>
                            {assignedPersonnel.map((person) => {
                              const latestOfficial = getLatestOfficialIPPT(person);

                              return (
                                <tr key={person.id}>
                                  <td>
                                    {person.name ||
                                      `${person.firstName || ""} ${person.lastName || ""
                                        }`.trim() ||
                                      "-"}
                                  </td>

                                  <td>{person.rank || "-"}</td>

                                  <td>{person.unit || "-"}</td>

                                  <td>
                                    <strong
                                      className={getOfficialResultClass(
                                        latestOfficial?.result
                                      )}
                                    >
                                      {latestOfficial?.result || "N/A"}
                                    </strong>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

// Convert an official IPPT record date into a comparable Date object
function getOfficialResultDate(record) {
  if (!record) {
    return new Date(0);
  }

  // Firestore Timestamp stored in date
  if (record.date?.toDate) {
    return record.date.toDate();
  }

  // Normal string date, for example: "2026-07-10"
  if (record.date) {
    const selectedDate = new Date(record.date);

    if (!Number.isNaN(selectedDate.getTime())) {
      return selectedDate;
    }
  }

  // Firestore Timestamp stored in createdAt
  if (record.createdAt?.toDate) {
    return record.createdAt.toDate();
  }

  // Normal createdAt date
  if (record.createdAt) {
    const createdDate = new Date(record.createdAt);

    if (!Number.isNaN(createdDate.getTime())) {
      return createdDate;
    }
  }

  return new Date(0);
}


// Return CSS class based on official IPPT result
function getOfficialResultClass(result) {
  if (result === "Gold") {
    return "ippt-gold";
  }

  if (result === "Silver") {
    return "ippt-silver";
  }

  if (result === "Pass") {
    return "ippt-pass";
  }

  if (result === "Fail") {
    return "ippt-fail";
  }

  return "";
}


export default Admin;