// TabDock - Dashboard Controller

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  let checkpoints = [];
  let activeSearch = "";
  
  // Active Checkpoint being edited in modal
  let activeCheckpoint = null;

  // UI Elements - Sidebar & Stats
  const statCheckpoints = document.getElementById("stat-checkpoints");
  const statTabs = document.getElementById("stat-tabs");
  const statRam = document.getElementById("stat-ram");
  
  // UI Elements - Main Grid
  const searchInput = document.getElementById("dashboard-search");
  const checkpointGrid = document.getElementById("checkpoint-grid");
  const gridEmptyState = document.getElementById("grid-empty-state");
  
  // UI Elements - Header actions
  const btnExport = document.getElementById("btn-export");
  const btnImport = document.getElementById("btn-import");
  const importFileInput = document.getElementById("import-file-input");

  // UI Elements - Checkpoint Details Modal
  const cpModal = document.getElementById("checkpoint-modal");
  const modalCpName = document.getElementById("modal-cp-name");
  const modalCpDate = document.getElementById("modal-cp-date");
  const modalCpNotes = document.getElementById("modal-cp-notes");
  const modalTabCountLabel = document.getElementById("modal-tab-count-label");
  const modalTabsList = document.getElementById("modal-tabs-list");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnModalSave = document.getElementById("modal-btn-save");
  const btnModalRestore = document.getElementById("modal-btn-restore");
  const btnModalDelete = document.getElementById("modal-btn-delete");
  const newTabTitleInput = document.getElementById("new-tab-title");
  const newTabUrlInput = document.getElementById("new-tab-url");
  const btnModalAddTab = document.getElementById("btn-modal-add-tab");

  // Utility: Date formatter (Relative Time)
  const getRelativeTime = (timestamp) => {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    
    // Absolute date fallback
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  // Utility: RAM Reclaimed Calculation
  const updateStats = () => {
    statCheckpoints.textContent = checkpoints.length;
    
    const totalTabsCount = checkpoints.reduce((sum, cp) => sum + ((cp && cp.tabs) ? cp.tabs.length : 0), 0);
    statTabs.textContent = totalTabsCount;
    
    // Estimate 40MB per tab
    const ramMB = totalTabsCount * 40;
    if (ramMB >= 1024) {
      statRam.textContent = `${(ramMB / 1024).toFixed(1)} GB`;
    } else {
      statRam.textContent = `${ramMB} MB`;
    }
  };

  // 1. Initial Load of Extension Data
  const loadData = () => {
    chrome.storage.local.get(["checkpoints"], (data) => {
      checkpoints = (data.checkpoints || []).map(cp => ({
        ...cp,
        name: cp.name || "Untitled Workspace",
        notes: cp.notes || "",
        tabs: Array.isArray(cp.tabs) ? cp.tabs : []
      }));
      
      updateStats();
      renderCheckpointGrid();
    });
  };

  // 2. Render Main Grid Cards
  const renderCheckpointGrid = () => {
    checkpointGrid.innerHTML = "";
    
    // Apply filters: Search Query
    let filtered = checkpoints;
    
    if (activeSearch.trim() !== "") {
      const query = activeSearch.toLowerCase().trim();
      filtered = filtered.filter(cp => {
        const cpName = (cp.name || "").toLowerCase();
        const cpNotes = (cp.notes || "").toLowerCase();
        const inName = cpName.includes(query);
        const inNotes = cpNotes.includes(query);
        const inTabs = Array.isArray(cp.tabs) && cp.tabs.some(tab => {
          const tabTitle = (tab && tab.title) ? tab.title.toLowerCase() : "";
          const tabUrl = (tab && tab.url) ? tab.url.toLowerCase() : "";
          return tabTitle.includes(query) || tabUrl.includes(query);
        });
        return inName || inNotes || inTabs;
      });
    }

    // Sort: newest first
    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (filtered.length === 0) {
      gridEmptyState.classList.remove("hidden");
      checkpointGrid.style.display = "none";
      return;
    }

    gridEmptyState.classList.add("hidden");
    checkpointGrid.style.display = "grid";

    filtered.forEach(checkpoint => {
      const card = document.createElement("article");
      card.className = "checkpoint-card";

      // Create card elements
      const header = document.createElement("div");
      header.className = "card-header";
      
      const dateSpan = document.createElement("span");
      dateSpan.className = "card-date";
      dateSpan.textContent = getRelativeTime(checkpoint.createdAt || Date.now());
      
      header.appendChild(dateSpan);

      const title = document.createElement("h2");
      title.className = "card-title";
      title.textContent = checkpoint.name;
      title.title = checkpoint.name;

      const notes = document.createElement("p");
      notes.className = "card-notes";
      notes.textContent = checkpoint.notes || "No additional notes provided.";

      // Favicons Strip (Limit to 6 icons)
      const faviconStrip = document.createElement("div");
      faviconStrip.className = "card-favicons";
      
      const maxFavicons = 6;
      const cpTabs = Array.isArray(checkpoint.tabs) ? checkpoint.tabs : [];
      const displayTabs = cpTabs.slice(0, maxFavicons);
      
      displayTabs.forEach(tab => {
        if (!tab) return;
        const wrap = document.createElement("div");
        wrap.className = "favicon-wrapper";
        wrap.title = tab.title || tab.url || "";

        // Chrome extension URLs or general icons
        if (tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
          const img = document.createElement("img");
          img.className = "favicon-img";
          img.src = tab.favIconUrl;
          img.alt = "";
          img.onerror = () => {
            img.style.display = "none";
            wrap.innerHTML = `<span class="favicon-fallback"></span>`;
          };
          wrap.appendChild(img);
        } else {
          const fallback = document.createElement("span");
          fallback.className = "favicon-fallback";
          wrap.appendChild(fallback);
        }
        faviconStrip.appendChild(wrap);
      });

      if (cpTabs.length > maxFavicons) {
        const moreSpan = document.createElement("span");
        moreSpan.className = "favicon-more";
        moreSpan.textContent = `+${cpTabs.length - maxFavicons}`;
        faviconStrip.appendChild(moreSpan);
      }

      // Card Actions footer
      const footer = document.createElement("footer");
      footer.className = "card-footer";

      // Split button group for restoration options
      const restoreGroup = document.createElement("div");
      restoreGroup.className = "restore-control-group";
      restoreGroup.addEventListener("click", (e) => e.stopPropagation());

      const btnRestore = document.createElement("button");
      btnRestore.className = "primary-gradient-btn";
      btnRestore.textContent = `Restore (${checkpoint.tabs.length})`;
      btnRestore.addEventListener("click", (e) => {
        e.stopPropagation();
        restoreCheckpoint(checkpoint, selectRestore.value);
      });

      const selectRestore = document.createElement("select");
      selectRestore.className = "restore-select";
      selectRestore.innerHTML = `
        <option value="new">New Window</option>
        <option value="current">Current Window</option>
      `;
      selectRestore.addEventListener("click", (e) => e.stopPropagation());

      restoreGroup.appendChild(btnRestore);
      restoreGroup.appendChild(selectRestore);

      const btnManage = document.createElement("button");
      btnManage.className = "secondary-btn card-btn-manage";
      btnManage.textContent = "View / Edit";
      btnManage.addEventListener("click", (e) => {
        e.stopPropagation();
        openCheckpointDetails(checkpoint);
      });

      const btnDelete = document.createElement("button");
      btnDelete.className = "card-btn-delete";
      btnDelete.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      btnDelete.title = "Delete Workspace";
      btnDelete.addEventListener("click", (e) => {
        e.stopPropagation();
        confirmDeleteCheckpoint(checkpoint.id);
      });

      footer.appendChild(restoreGroup);
      footer.appendChild(btnManage);
      footer.appendChild(btnDelete);

      card.appendChild(header);
      card.appendChild(title);
      card.appendChild(notes);
      card.appendChild(faviconStrip);
      card.appendChild(footer);
      
      // Click card opens details
      card.addEventListener("click", () => {
        openCheckpointDetails(checkpoint);
      });

      checkpointGrid.appendChild(card);
    });
  };

  // 3. Restore Checkpoint Action
  const restoreCheckpoint = (checkpoint, mode) => {
    const urls = checkpoint.tabs.map(tab => tab.url);
    if (urls.length === 0) return;
    
    if (mode === "current") {
      urls.forEach((url, i) => {
        chrome.tabs.create({ url: url, active: i === 0 });
      });
    } else {
      chrome.windows.create({ url: urls, focused: true });
    }
  };

  // 4. Delete Checkpoint Action
  const confirmDeleteCheckpoint = (checkpointId) => {
    if (confirm("Are you sure you want to delete this workspace? You cannot undo this action.")) {
      checkpoints = checkpoints.filter(cp => cp.id !== checkpointId);
      chrome.storage.local.set({ checkpoints: checkpoints }, () => {
        loadData();
      });
    }
  };

  // 5. Checkpoint Details Modal Logic
  const openCheckpointDetails = (checkpoint) => {
    activeCheckpoint = checkpoint;
    
    // Load metadata
    modalCpName.value = checkpoint.name;
    modalCpNotes.value = checkpoint.notes || "";
    
    const formattedDate = new Date(checkpoint.createdAt).toLocaleString(undefined, { 
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" 
    });
    modalCpDate.textContent = `Saved ${formattedDate}`;

    // Clear add tab fields
    newTabTitleInput.value = "";
    newTabUrlInput.value = "";

    // Render tab list
    renderModalTabsList();

    // Show modal
    cpModal.classList.remove("hidden");
  };

  const renderModalTabsList = () => {
    modalTabsList.innerHTML = "";
    modalTabCountLabel.textContent = `Tabs in this Checkpoint (${activeCheckpoint.tabs.length})`;

    if (activeCheckpoint.tabs.length === 0) {
      modalTabsList.innerHTML = `<div class="empty-state">No tabs in this checkpoint. Add one below!</div>`;
      return;
    }

    activeCheckpoint.tabs.forEach((tab, index) => {
      const row = document.createElement("div");
      row.className = "modal-tab-row";

      const left = document.createElement("div");
      left.className = "tab-row-left";

      // Icon
      const wrap = document.createElement("div");
      wrap.className = "favicon-wrapper";
      if (tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
        wrap.innerHTML = `<img class="favicon-img" src="${tab.favIconUrl}" alt="">`;
      } else {
        wrap.innerHTML = `<span class="favicon-fallback"></span>`;
      }

      // Text Anchor
      const link = document.createElement("a");
      link.className = "tab-link";
      link.href = tab.url;
      link.target = "_blank";
      link.textContent = tab.title || tab.url;
      link.title = tab.title;

      const urlSpan = document.createElement("span");
      urlSpan.className = "tab-row-url";
      urlSpan.textContent = tab.url;

      left.appendChild(wrap);
      left.appendChild(link);
      left.appendChild(urlSpan);

      // Delete Tab btn
      const btnDelTab = document.createElement("button");
      btnDelTab.className = "tab-delete-btn";
      btnDelTab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      btnDelTab.title = "Remove tab from checkpoint";
      btnDelTab.addEventListener("click", () => {
        activeCheckpoint.tabs.splice(index, 1);
        renderModalTabsList();
      });

      row.appendChild(left);
      row.appendChild(btnDelTab);
      modalTabsList.appendChild(row);
    });
  };

  // Add tab inside Modal
  btnModalAddTab.addEventListener("click", () => {
    let url = newTabUrlInput.value.trim();
    let title = newTabTitleInput.value.trim() || url;

    if (!url) return;

    // Ensure valid URL prefix
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    // Set fallback title if needed
    if (title === url) {
      try {
        title = new URL(url).hostname;
      } catch (e) {
        title = "External Link";
      }
    }

    const newTab = {
      url: url,
      title: title,
      favIconUrl: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=16`
    };

    activeCheckpoint.tabs.push(newTab);
    newTabTitleInput.value = "";
    newTabUrlInput.value = "";
    renderModalTabsList();
  });

  // Save Modal Edits
  btnModalSave.addEventListener("click", () => {
    const updatedName = modalCpName.value.trim() || activeCheckpoint.name;
    const updatedNotes = modalCpNotes.value.trim();

    activeCheckpoint.name = updatedName;
    activeCheckpoint.notes = updatedNotes;

    // Update in local state array
    const idx = checkpoints.findIndex(cp => cp.id === activeCheckpoint.id);
    if (idx !== -1) {
      checkpoints[idx] = activeCheckpoint;
    }

    chrome.storage.local.set({ checkpoints: checkpoints }, () => {
      loadData();
      cpModal.classList.add("hidden");
    });
  });

  // Restore from Modal
  btnModalRestore.addEventListener("click", () => {
    const restoreSelect = document.getElementById("modal-restore-select");
    const mode = restoreSelect ? restoreSelect.value : "new";
    restoreCheckpoint(activeCheckpoint, mode);
    cpModal.classList.add("hidden");
  });

  // Delete from Modal
  btnModalDelete.addEventListener("click", () => {
    cpModal.classList.add("hidden");
    setTimeout(() => {
      confirmDeleteCheckpoint(activeCheckpoint.id);
    }, 150);
  });

  // Close details Modal
  btnCloseModal.addEventListener("click", () => {
    cpModal.classList.add("hidden");
  });

  // Hide details modal if clicked outside
  cpModal.addEventListener("click", (e) => {
    if (e.target === cpModal) {
      cpModal.classList.add("hidden");
    }
  });

  // 6. Search Input filtering
  searchInput.addEventListener("input", (e) => {
    activeSearch = e.target.value;
    renderCheckpointGrid();
  });

  // 7. Data Export / Import Logic (JSON Backup)
  btnExport.addEventListener("click", () => {
    const backupData = {
      version: "1.0.0",
      exportTime: Date.now(),
      checkpoints: checkpoints
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    
    const dlAnchor = document.createElement("a");
    const dateStamp = new Date().toISOString().split('T')[0];
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `tabdock_backup_${dateStamp}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  });

  btnImport.addEventListener("click", () => {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.checkpoints) {
          if (confirm("This will merge imported workspaces with your current data. Proceed?")) {
            // Merge Checkpoints (de-duplicate by ID)
            const checkpointMap = new Map();
            checkpoints.forEach(cp => checkpointMap.set(cp.id, cp));
            data.checkpoints.forEach(cp => checkpointMap.set(cp.id, cp));

            const mergedCPs = Array.from(checkpointMap.values());

            chrome.storage.local.set({
              checkpoints: mergedCPs
            }, () => {
              loadData();
              alert("Data imported successfully! Merged workspaces.");
            });
          }
        } else {
          alert("Invalid backup file. Could not parse TabDock data.");
        }
      } catch (err) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
    importFileInput.value = "";
  });

  // 8. Real-time Storage Listener (Auto-updates dashboard when saved from popup)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.checkpoints) {
      loadData();
    }
  });

  // Initialize
  loadData();
});
