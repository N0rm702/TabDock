// TabDock - Popup Script

document.addEventListener("DOMContentLoaded", () => {
  // UI Elements
  const instanceNameInput = document.getElementById("instance-name");
  const instanceNotes = document.getElementById("instance-notes");
  const tabCountLabel = document.getElementById("tab-count-label");
  const btnSaveClose = document.getElementById("btn-save-close");
  const btnSaveKeep = document.getElementById("btn-save-keep");
  const recentList = document.getElementById("recent-list");
  const lnkDashboard = document.getElementById("lnk-dashboard");
  const btnOpenDashboard = document.getElementById("btn-open-dashboard");
  const tabsListSelect = document.getElementById("tabs-list-select");
  const btnToggleSelectAll = document.getElementById("btn-toggle-select-all");

  let allTabs = [];
  let selectAllState = true; // true = "Deselect All", false = "Select All"

  // 1. Initialize Default Name
  const formatDefaultName = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const timeStr = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
    return `Study Session - ${dateStr} (${timeStr})`;
  };
  instanceNameInput.value = formatDefaultName();

  // 2. Fetch Open Tabs in current window & Render Checklist
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    // Filter out extensions and chrome pages
    allTabs = tabs.filter(tab => !tab.url.startsWith("chrome-extension://"));
    
    renderTabsChecklist();
    updateSelectionCount();
  });

  const renderTabsChecklist = () => {
    tabsListSelect.innerHTML = "";
    
    if (allTabs.length === 0) {
      tabsListSelect.innerHTML = `<div class="empty-state">No saveable tabs open in this window.</div>`;
      btnToggleSelectAll.style.display = "none";
      return;
    }

    btnToggleSelectAll.style.display = "block";

    allTabs.forEach(tab => {
      const item = document.createElement("div");
      item.className = "tab-select-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.id = `tab-check-${tab.id}`;
      checkbox.dataset.tabId = tab.id;

      const label = document.createElement("label");
      label.className = "tab-select-label";
      label.htmlFor = `tab-check-${tab.id}`;

      // Favicon
      if (tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
        const img = document.createElement("img");
        img.className = "tab-select-favicon";
        img.src = tab.favIconUrl;
        img.onerror = () => {
          img.style.display = "none";
          label.insertAdjacentHTML("afterbegin", `<span class="tab-select-favicon-fallback"></span>`);
        };
        label.appendChild(img);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "tab-select-favicon-fallback";
        label.appendChild(fallback);
      }

      // Title
      const titleSpan = document.createElement("span");
      titleSpan.className = "tab-select-title";
      titleSpan.textContent = tab.title || tab.url;
      titleSpan.title = tab.title;
      label.appendChild(titleSpan);

      // Event listener to update counts
      checkbox.addEventListener("change", () => {
        updateSelectionCount();
      });

      // Assemble
      item.appendChild(checkbox);
      item.appendChild(label);
      tabsListSelect.appendChild(item);
    });
  };

  const updateSelectionCount = () => {
    const checkboxes = tabsListSelect.querySelectorAll("input[type='checkbox']");
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const totalCount = checkboxes.length;

    tabCountLabel.textContent = `${checkedCount} of ${totalCount} tab${totalCount !== 1 ? 's' : ''} selected`;

    // Enable/disable buttons based on whether at least one tab is selected
    const disabledState = checkedCount === 0;
    btnSaveClose.disabled = disabledState;
    btnSaveKeep.disabled = disabledState;
    btnSaveClose.style.opacity = disabledState ? "0.5" : "1";
    btnSaveKeep.style.opacity = disabledState ? "0.5" : "1";

    // Update the Toggle All button label
    if (checkedCount === totalCount) {
      btnToggleSelectAll.textContent = "Deselect All";
      selectAllState = true;
    } else if (checkedCount === 0) {
      btnToggleSelectAll.textContent = "Select All";
      selectAllState = false;
    } else {
      btnToggleSelectAll.textContent = "Select All";
      selectAllState = false;
    }
  };

  // Toggle All Selection Action
  btnToggleSelectAll.addEventListener("click", () => {
    const checkboxes = tabsListSelect.querySelectorAll("input[type='checkbox']");
    
    checkboxes.forEach(cb => {
      cb.checked = !selectAllState;
    });

    selectAllState = !selectAllState;
    btnToggleSelectAll.textContent = selectAllState ? "Deselect All" : "Select All";
    
    updateSelectionCount();
  });

  // 3. Save Checkpoint Core Logic
  const saveCheckpoint = (shouldCloseTabs) => {
    const checkboxes = tabsListSelect.querySelectorAll("input[type='checkbox']");
    const checkedTabIdStrings = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => String(cb.dataset.tabId));

    if (checkedTabIdStrings.length === 0) return;

    // Filter allTabs to get only checked ones
    const selectedTabs = allTabs.filter(tab => tab && tab.id !== undefined && checkedTabIdStrings.includes(String(tab.id)));

    const name = instanceNameInput.value.trim() || formatDefaultName();
    const notes = instanceNotes.value.trim();

    // Map tab items
    const tabsData = selectedTabs.map(tab => ({
      url: tab.url || "",
      title: tab.title || tab.url || "Untitled Tab",
      favIconUrl: tab.favIconUrl || ""
    }));

    const checkpointId = "cp_" + Date.now();
    const newCheckpoint = {
      id: checkpointId,
      name: name,
      createdAt: Date.now(),
      notes: notes,
      tabs: tabsData
    };

    chrome.storage.local.get(["checkpoints"], (data) => {
      const checkpoints = data.checkpoints || [];
      checkpoints.push(newCheckpoint);

      chrome.storage.local.set({ checkpoints: checkpoints }, () => {
        if (shouldCloseTabs) {
          // Open the dashboard page so the user doesn't end up with an empty browser window
          const dashboardUrl = chrome.runtime.getURL("dashboard.html");
          chrome.tabs.create({ url: dashboardUrl }, () => {
            // Close ONLY the saved tabs in the current window
            const tabIdsToClose = selectedTabs.map(t => t.id).filter(id => id !== undefined);
            if (tabIdsToClose.length > 0) {
              chrome.tabs.remove(tabIdsToClose);
            }
            window.close(); // Close popup
          });
        } else {
          // Flash success animation, reload popup list, or close window
          const originalText = btnSaveKeep.textContent;
          btnSaveKeep.textContent = "Saved Successfully ✓";
          btnSaveKeep.style.background = "var(--success-color)";
          btnSaveKeep.style.color = "#ffffff";
          
          setTimeout(() => {
            btnSaveKeep.textContent = originalText;
            btnSaveKeep.style.background = "";
            btnSaveKeep.style.color = "";
            loadRecentCheckpoints();
            setTimeout(() => window.close(), 500);
          }, 1000);
        }
      });
    });
  };

  btnSaveClose.addEventListener("click", () => saveCheckpoint(true));
  btnSaveKeep.addEventListener("click", () => saveCheckpoint(false));

  // Helper: Relative Time Formatter
  const getRelativeTime = (timestamp) => {
    if (!timestamp) return "recently";
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 60) return "just now";
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
    return `${Math.floor(elapsed / 86400)}d ago`;
  };

  // 4. Load & Render Recent Checkpoints (limit to 4)
  const loadRecentCheckpoints = () => {
    chrome.storage.local.get(["checkpoints"], (data) => {
      const checkpoints = (data.checkpoints || []).map(cp => ({
        ...cp,
        name: cp.name || "Untitled Workspace",
        tabs: Array.isArray(cp.tabs) ? cp.tabs : []
      }));
      
      // Sort: newest first
      checkpoints.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const recents = checkpoints.slice(0, 4);

      if (recents.length === 0) {
        recentList.innerHTML = `<div class="empty-state">No saved workspaces yet. Create one above!</div>`;
        return;
      }

      recentList.innerHTML = "";
      recents.forEach(checkpoint => {
        const item = document.createElement("div");
        item.className = "checkpoint-item";
        
        const info = document.createElement("div");
        info.className = "checkpoint-info";
        
        const title = document.createElement("div");
        title.className = "checkpoint-title";
        title.textContent = checkpoint.name;
        title.title = checkpoint.name;
        
        const meta = document.createElement("div");
        meta.className = "checkpoint-meta";
        
        const tabCount = document.createElement("span");
        tabCount.className = "tab-count";
        const len = checkpoint.tabs.length;
        tabCount.textContent = `${len} tab${len !== 1 ? 's' : ''}`;
        
        const timeSpan = document.createElement("span");
        timeSpan.className = "time-ago";
        timeSpan.textContent = getRelativeTime(checkpoint.createdAt);

        meta.appendChild(tabCount);
        meta.appendChild(document.createTextNode(" • "));
        meta.appendChild(timeSpan);
        
        info.appendChild(title);
        info.appendChild(meta);
        
        const restoreGroup = document.createElement("div");
        restoreGroup.className = "restore-control-group compact-group";

        const btnRestore = document.createElement("button");
        btnRestore.className = "restore-action-btn";
        btnRestore.textContent = "Restore";
        btnRestore.title = "Open tabs";
        
        const selectRestore = document.createElement("select");
        selectRestore.className = "restore-select compact-select";
        selectRestore.innerHTML = `
          <option value="new">New</option>
          <option value="current">Current</option>
        `;

        btnRestore.addEventListener("click", () => {
          const urls = checkpoint.tabs.map(t => t.url).filter(Boolean);
          if (urls.length === 0) return;
          const mode = selectRestore.value;
          
          if (mode === "current") {
            urls.forEach((url, i) => {
              chrome.tabs.create({ url: url, active: i === 0 });
            });
            window.close();
          } else {
            chrome.windows.create({ url: urls, focused: true }, () => {
              window.close();
            });
          }
        });
        
        restoreGroup.appendChild(btnRestore);
        restoreGroup.appendChild(selectRestore);
        
        const btnDelete = document.createElement("button");
        btnDelete.className = "recent-delete-btn";
        btnDelete.title = "Delete Workspace";
        btnDelete.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        `;
        btnDelete.addEventListener("click", () => {
          if (confirm(`Are you sure you want to delete "${checkpoint.name}"?`)) {
            chrome.storage.local.get(["checkpoints"], (data) => {
              const checkpoints = data.checkpoints || [];
              const updated = checkpoints.filter(cp => cp.id !== checkpoint.id);
              chrome.storage.local.set({ checkpoints: updated }, () => {
                loadRecentCheckpoints();
              });
            });
          }
        });

        const actionsGroup = document.createElement("div");
        actionsGroup.className = "checkpoint-actions-group";
        actionsGroup.appendChild(restoreGroup);
        actionsGroup.appendChild(btnDelete);
        
        item.appendChild(info);
        item.appendChild(actionsGroup);
        recentList.appendChild(item);
      });
    });
  };

  // Realtime storage listener for popup
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.checkpoints) {
      loadRecentCheckpoints();
    }
  });

  loadRecentCheckpoints();

  // 5. Navigation Links
  const openDashboard = (e) => {
    if (e) e.preventDefault();
    chrome.tabs.create({ url: "dashboard.html" });
    window.close();
  };

  lnkDashboard.addEventListener("click", openDashboard);
  btnOpenDashboard.addEventListener("click", openDashboard);
});
