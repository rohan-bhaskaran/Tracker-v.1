//VARIABLES
const searchInput = document.getElementById("searchInput");
const noteInput = document.getElementById("noteInput");
const saveBtn = document.getElementById("saveBtn");
const notesContainer = document.getElementById("notesContainer");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const trashBtn = document.getElementById("trashBtn");

//STATE
let notes = JSON.parse(localStorage.getItem("notes")) || [];
let versions = JSON.parse(localStorage.getItem("versions")) || [];
let currentVersionIndex = versions.length ? versions.length - 1 : -1;
let searchQuery = "";
let viewMode = "active";

if (versions.length === 0) {
  saveVersion("Initial state");
}


//COMMIT (undoable)
function commit(label) {
  saveVersion(label);
  persist();
  renderNotes();
}

//PERSIST
function persist() {
  localStorage.setItem("notes", JSON.stringify(notes));
  localStorage.setItem("versions", JSON.stringify(versions));
}

//VERSION CONTROL
undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

function updateHistoryButtons() {
  undoBtn.disabled = currentVersionIndex <= 0;
  redoBtn.disabled = currentVersionIndex >= versions.length - 1;
}

function saveVersion(label = "Change") {
  versions = versions.slice(0,currentVersionIndex+1);

  const snapshot = {
    label,
    time: new Date().toLocaleString(),
    notes: JSON.parse(JSON.stringify(notes)) // this JSON.parse(JSON.stringify()) helps create a deep copy
  };

  versions.push(snapshot);
  currentVersionIndex++;
  updateHistoryButtons();
};

function undo() {
  if (currentVersionIndex <= 0) return;

  currentVersionIndex--;

  notes = JSON.parse(
    JSON.stringify(versions[currentVersionIndex].notes)
  );

  persist();
  renderNotes();
  updateHistoryButtons();
}

function redo() {
  if (currentVersionIndex >= versions.length - 1) return;

  currentVersionIndex++;
  notes = JSON.parse(
    JSON.stringify(versions[currentVersionIndex].notes)
  );

  persist();
  renderNotes();
  updateHistoryButtons();
}

function restoreVersion(index) {
  const snapshot = versions[index];
  if (!snapshot) return;

  notes = JSON.parse(JSON.stringify(snapshot.notes));
  localStorage.setItem("notes", JSON.stringify(notes));
  renderNotes();
};

window.showVersions = function () {
  console.clear();
  versions.forEach((v,i) => {
    console.log(`${i}: ${v.label} @ ${v.time}`);
  });
};

//SEARCH NOTES
searchInput.addEventListener("input", () => { //damn insted of searching on basis of enter we using on basis of each letter so we see searches in real time
  searchQuery = searchInput.value.toLowerCase();
  renderNotes();
});

function highlightText(text, query) {
  if (!query) return text;

  const escaped = query.replace(/[.*+?{}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");

  return text.replace(regex, `<mark>$1</mark>`);
}

// NOTES CREATE
function createNote(text) {
  return {
    id: crypto.randomUUID(),
    text,
    time: new Date().toLocaleString(),
    pinned: false,
    deleted: false,
    tags: extractTags(text)
  }
}

function addNote(text) {
  const note = createNote(text);
  notes.push(note);
  commit("Add note");
}

function extractTags(text) {
  const matches = text.match(/#\w+/g);
  return matches ? matches.map(tag => tag.slice(1)) : [];
};

//SAVE NOTES
saveBtn.addEventListener("click", () => {
  const text = noteInput.value.trim();
  if (text === "") return;
  addNote(text);
  noteInput.value = "";
  noteInput.blur();
});

//DELETE NOTES
function deleteNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note || note.deleted) return;

  note.deleted = true;
  commit("Deleted note");
  showUndo(id);
}

trashBtn.addEventListener("click", () => {
  viewMode = viewMode === "active" ? "trash" : "active";
  trashBtn.textContent = viewMode === "trash" ? "← Back" : "🗑 Trash";
  renderNotes();
});

function permanentlyDelete(id) {
  notes = notes.filter(n => n.id !== id);
  versions.forEach(v => {
    v.notes = v.notes.filter(n => n.id !== id);//deletin that obj in each version (key feature)
  });

  persist();
  renderNotes();
  updateHistoryButtons();
}

//PIN NOTES
function togglePin(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  note.pinned = !note.pinned;
  commit("Toggle pin");
}

//EDIT NOTES
function editNote(id, newText) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  const text = newText.trim();

  if (text === "") {
    deleteNote(id);
    return;
  }

  note.text = text;
  note.tags = extractTags(text);
  commit("Edit note");
}

//RENDER UI
function renderNotes() {
  const visible = notes.filter(n =>
    viewMode === "trash" ? n.deleted : !n.deleted
  );

  if (!visible.length) {
    notesContainer.innerHTML = `
      <div class="empty-state">
        ${viewMode === "trash" ? "Trash is empty 🧹" : "Your mind is clear ✨"}
      </div>
    `;
    return;
  }

  notesContainer.innerHTML = "";

  //FILTER
  let filteredNotes = notes.filter(note => {
    if (viewMode === "active" && note.deleted) return false;
    if (viewMode === "trash" && !note.deleted) return false;
    
    const textMatch = note.text.toLowerCase().includes(searchQuery);
    const tagMatch = (note.tags || []).some(tag =>
      tag.toLowerCase().includes(searchQuery) // includes helps to do partial search , so like search script for javascript result
    );
    return textMatch || tagMatch;// either text or tag matches the search
  })
  
  const sortedNotes = [...filteredNotes].sort((a,b) => b.pinned - a.pinned);

  //SORT
  sortedNotes.forEach((note) => {
    const div = document.createElement("div");
    div.className = "note";

    const textE1 = document.createElement("div");
    textE1.innerHTML = highlightText(note.text, searchQuery);
    textE1.className = "note-text";
    
    const timeE1 = document.createElement("small");
    timeE1.textContent = note.time;
    timeE1.style.opacity = "0.6";

    const tagsE1 = document.createElement("div");
    tagsE1.className = "tags";

    //TAG SEARCH BY ONCLICK
    (note.tags || []).forEach(tag => {
      const span = document.createElement("span");
      span.textContent = `#${tag}`;
      span.style.cursor = "pointer";

      span.addEventListener("click", () => {
        searchInput.value = tag;
        searchQuery = tag.toLowerCase();
        renderNotes();
      });

      tagsE1.appendChild(span);
    });

    if (!tagsE1.children.length) tagsE1.style.display = "none";

    //EDITING
    textE1.addEventListener("dblclick", () => {
      textE1.innerHTML = note.text;
      textE1.setAttribute("contenteditable", "true");
      textE1.focus(); //Focus means: this element is currently active and ready for input Cursor appears, Keyboard input starts going there ,Screen readers understand it’s active
    });

    textE1.addEventListener("blur", () => { //blur helps exit edit mode
      textE1.removeAttribute("contenteditable");
      editNote(note.id, textE1.textContent);
    });

    //PINING
    const pinBtn = document.createElement("button");
    pinBtn.textContent = note.pinned ? "📌" : "📍";
    pinBtn.className = "pin-btn";
    pinBtn.addEventListener("click", () => {
      togglePin(note.id);
    })
    
    //DELETING
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";

    if (viewMode === "active") {
      deleteBtn.textContent = "❌";
      deleteBtn.addEventListener("click", () => {
        deleteNote(note.id);
      });
    } else {
      deleteBtn.textContent = "🧨";
      deleteBtn.addEventListener("click", () => {
        permanentlyDelete(note.id); 
      });

      const restoreBtn = document.createElement("button");
      restoreBtn.textContent = "♻";
      restoreBtn.className = "restore-btn";
      restoreBtn.addEventListener("click", () => {
        note.deleted = false;
        commit("Restore note");
      });

      div.appendChild(restoreBtn);
    }

    if (tagsE1.children.length === 0) {
      tagsE1.style.display = "none";
    }
    
    div.appendChild(pinBtn);
    div.appendChild(textE1);
    div.appendChild(timeE1);
    div.appendChild(tagsE1);
    div.appendChild(deleteBtn);

    notesContainer.appendChild(div);
  });
};

//DELETE UNDO
function showUndo(noteId) {
  const undo = document.createElement("div");
  undo.className = "undo";
  undo.textContent = "Note deleted. Undo?";

  undo.addEventListener("click", () => {
    const note = notes.find(n => n.id === noteId);
    if (!note || viewMode === "trash") return;

    console.log("UNDO CALLED");
    note.deleted = false;
    commit("Undo delete")

    undo.remove();
  });

  document.body.appendChild(undo);
  setTimeout(() => undo.remove(), 4000);
};

//SHORTCUTS
function isTypingContext() {
  const el = document.activeElement;
  if (!el) return false;

  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable
  );
}

noteInput.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  
  if (key === "enter" && !e.shiftKey && document.activeElement === noteInput) {
    e.preventDefault();
    const text = noteInput.value.trim();
    if (!text) return;

    addNote(text);
    noteInput.value = "";
  }

  // if (e.key === "Escape") {
  //   noteInput.value = "";
  //   noteInput.blur();
  // }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.activeElement?.isContentEditable) {
    e.preventDefault();
    document.activeElement.blur();
    return;
  }

  const key = e.key.toLowerCase();

  //disable in trash view and typing
  if (isTypingContext()) return;
  if (viewMode === "trash") return;

  if (e.ctrlKey && key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  }

  if (e.ctrlKey && key === "y" && !e.shiftKey) {
    e.preventDefault();
    redo();
  }
    
  if (e.ctrlKey && key === "z" && e.shiftKey) {
    e.preventDefault();
    redo();
  }

  if (e.ctrlKey && (key === "/" || key === "?")) {
    e.preventDefault();
    searchInput.focus();
  }

  if (e.key === "Escape") {

    if (document.activeElement === noteInput) {
      noteInput.value = "";
      noteInput.blur();
      return;
    }

    if (document.activeElement?.isContentEditable) {
      document.activeElement.blur();
      return;
    }

    if (searchInput.value) {
      searchInput.value = "";
      searchQuery = "";
      renderNotes();
    }

    console.log("ESC pressed");
  }
}, {capture: true});

renderNotes();
console.log(notes);
