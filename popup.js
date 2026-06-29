// TabDock - Popup Script

document.addEventListener("DOMContentLoaded", () => {
  // UI Elements
  const instanceNameInput = document.getElementById("instance-name");
  const instanceNotes = document.getElementById("instance-notes");
  const tabCountLabel = document.getElementById("tab-count-label");
  const btnSaveClose = document.getElementById("btn-save-close");
  const btnSaveKeep = document.getElementById("btn-save-keep");
  const recentList = document.getElementById("recent-list");
  const tabsListSelect = document.getElementById("tabs-list-select");
  const btnToggleSelectAll = document.getElementById("btn-toggle-select-all");
  const workspaceSearch = document.getElementById("workspace-search");
  const totalWorkspacesCount = document.getElementById("total-workspaces-count");

  let allTabs = [];
  let selectAllState = true; // true = "Deselect All", false = "Select All"
  let searchQuery = "";
  const expandedWorkspaceIds = new Set();

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
    allTabs = tabs.filter(tab => tab.url && !tab.url.startsWith("chrome-extension://"));
    
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
          const tabIdsToClose = selectedTabs.map(t => t.id).filter(id => id !== undefined);
          if (tabIdsToClose.length > 0) {
            chrome.tabs.remove(tabIdsToClose);
          }
          window.close(); // Close popup
        } else {
          // Flash success animation & reload list
          const originalText = btnSaveKeep.textContent;
          btnSaveKeep.textContent = "Saved Successfully ✓";
          btnSaveKeep.style.background = "var(--success-color)";
          btnSaveKeep.style.color = "#ffffff";
          
          setTimeout(() => {
            btnSaveKeep.textContent = originalText;
            btnSaveKeep.style.background = "";
            btnSaveKeep.style.color = "";
            loadRecentCheckpoints();
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

  // 4. Load & Render All Saved Workspaces
  const loadRecentCheckpoints = () => {
    chrome.storage.local.get(["checkpoints"], (data) => {
      let checkpoints = (data.checkpoints || []).map(cp => ({
        ...cp,
        name: cp.name || "Untitled Workspace",
        notes: cp.notes || "",
        tabs: Array.isArray(cp.tabs) ? cp.tabs : []
      }));
      
      if (totalWorkspacesCount) {
        totalWorkspacesCount.textContent = `${checkpoints.length} saved`;
      }

      // Sort: newest first
      checkpoints.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      // Apply search query filter if typed
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        checkpoints = checkpoints.filter(cp => {
          const inName = cp.name.toLowerCase().includes(q);
          const inNotes = cp.notes.toLowerCase().includes(q);
          const inTabs = cp.tabs.some(t => (t.title && t.title.toLowerCase().includes(q)) || (t.url && t.url.toLowerCase().includes(q)));
          return inName || inNotes || inTabs;
        });
      }

      if (checkpoints.length === 0) {
        recentList.innerHTML = `<div class="empty-state">${searchQuery ? "No matching workspaces found." : "No saved workspaces yet. Create one above!"}</div>`;
        return;
      }

      recentList.innerHTML = "";
      checkpoints.forEach(checkpoint => {
        const cardContainer = document.createElement("div");
        cardContainer.className = "workspace-card-wrapper";

        const item = document.createElement("div");
        item.className = "checkpoint-item";
        
        const headerClickable = document.createElement("div");
        headerClickable.className = "item-header-clickable";
        headerClickable.title = "Click to view tabs";

        const btnToggleDropdown = document.createElement("button");
        btnToggleDropdown.className = "chevron-toggle-btn";
        btnToggleDropdown.setAttribute("aria-label", "Toggle Tabs List");
        btnToggleDropdown.innerHTML = `
          <svg class="chevron-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        `;

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

        headerClickable.appendChild(btnToggleDropdown);
        headerClickable.appendChild(info);
        
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

        btnRestore.addEventListener("click", (e) => {
          e.stopPropagation();
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
        
        selectRestore.addEventListener("click", (e) => e.stopPropagation());

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
        btnDelete.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm(`Are you sure you want to delete "${checkpoint.name}"?`)) {
            chrome.storage.local.get(["checkpoints"], (data) => {
              const checkpointsArr = data.checkpoints || [];
              const updated = checkpointsArr.filter(cp => cp.id !== checkpoint.id);
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
        
        item.appendChild(headerClickable);
        item.appendChild(actionsGroup);

        // Dropdown tabs menu container
        const dropdownList = document.createElement("div");
        const isInitiallyExpanded = expandedWorkspaceIds.has(checkpoint.id);
        dropdownList.className = `checkpoint-tabs-dropdown ${isInitiallyExpanded ? "" : "hidden"}`;
        if (isInitiallyExpanded) {
          btnToggleDropdown.classList.add("expanded");
        }

        const tabsRowsContainer = document.createElement("div");
        tabsRowsContainer.className = "dropdown-tabs-rows";

        if (checkpoint.tabs.length === 0) {
          tabsRowsContainer.innerHTML = `<div class="dropdown-empty">No tabs in this workspace yet. Add one below!</div>`;
        } else {
          checkpoint.tabs.forEach((tab, index) => {
            const tabRow = document.createElement("div");
            tabRow.className = "dropdown-tab-row";

            // Favicon
            if (tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
              const img = document.createElement("img");
              img.className = "dropdown-tab-favicon";
              img.src = tab.favIconUrl;
              img.onerror = () => {
                img.style.display = "none";
                tabRow.insertAdjacentHTML("afterbegin", `<span class="dropdown-tab-favicon-fallback"></span>`);
              };
              tabRow.appendChild(img);
            } else {
              const fallback = document.createElement("span");
              fallback.className = "dropdown-tab-favicon-fallback";
              tabRow.appendChild(fallback);
            }

            // Title link
            const tabLink = document.createElement("a");
            tabLink.className = "dropdown-tab-link";
            tabLink.textContent = tab.title || tab.url || "Untitled Tab";
            tabLink.title = `${tab.title}\n${tab.url}`;
            tabLink.href = "#";
            tabLink.addEventListener("click", (e) => {
              e.preventDefault();
              if (tab.url) {
                chrome.tabs.create({ url: tab.url });
              }
            });
            tabRow.appendChild(tabLink);

            // Remove individual tab button
            const btnRemoveTab = document.createElement("button");
            btnRemoveTab.className = "btn-remove-tab";
            btnRemoveTab.title = "Remove tab from workspace";
            btnRemoveTab.innerHTML = "&times;";
            btnRemoveTab.addEventListener("click", (e) => {
              e.stopPropagation();
              chrome.storage.local.get(["checkpoints"], (data) => {
                const checkpointsArr = data.checkpoints || [];
                const cpIdx = checkpointsArr.findIndex(c => c.id === checkpoint.id);
                if (cpIdx !== -1) {
                  checkpointsArr[cpIdx].tabs.splice(index, 1);
                  chrome.storage.local.set({ checkpoints: checkpointsArr }, () => {
                    loadRecentCheckpoints();
                  });
                }
              });
            });
            tabRow.appendChild(btnRemoveTab);

            tabsRowsContainer.appendChild(tabRow);
          });
        }

        dropdownList.appendChild(tabsRowsContainer);

        // Add Tab Tools Footer inside Dropdown
        const addActionsFooter = document.createElement("div");
        addActionsFooter.className = "dropdown-add-footer";

        // Button: Add Current Active Tab
        const btnAddActiveTab = document.createElement("button");
        btnAddActiveTab.className = "btn-add-active-tab";
        btnAddActiveTab.title = "Add the current browser tab to this workspace";
        btnAddActiveTab.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Current Active Tab
        `;
        btnAddActiveTab.addEventListener("click", (e) => {
          e.stopPropagation();
          chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
            if (activeTabs && activeTabs[0]) {
              const activeTab = activeTabs[0];
              const newTabData = {
                url: activeTab.url || "",
                title: activeTab.title || activeTab.url || "Untitled Tab",
                favIconUrl: activeTab.favIconUrl || ""
              };
              chrome.storage.local.get(["checkpoints"], (data) => {
                const checkpointsArr = data.checkpoints || [];
                const cpIdx = checkpointsArr.findIndex(c => c.id === checkpoint.id);
                if (cpIdx !== -1) {
                  checkpointsArr[cpIdx].tabs.push(newTabData);
                  chrome.storage.local.set({ checkpoints: checkpointsArr }, () => {
                    loadRecentCheckpoints();
                  });
                }
              });
            }
          });
        });

        // Custom URL inline input form
        const customFormRow = document.createElement("div");
        customFormRow.className = "dropdown-custom-form";

        const inputCustomUrl = document.createElement("input");
        inputCustomUrl.type = "text";
        inputCustomUrl.placeholder = "Or paste URL / title...";
        inputCustomUrl.className = "input-custom-url";
        inputCustomUrl.addEventListener("click", (e) => e.stopPropagation());

        const btnSubmitCustom = document.createElement("button");
        btnSubmitCustom.className = "btn-submit-custom";
        btnSubmitCustom.textContent = "Add";
        btnSubmitCustom.title = "Add typed link";

        const submitCustomLink = (e) => {
          if (e) e.stopPropagation();
          const val = inputCustomUrl.value.trim();
          if (!val) return;
          let urlVal = val;
          if (!urlVal.startsWith("http://") && !urlVal.startsWith("https://") && urlVal.includes(".")) {
            urlVal = "https://" + urlVal;
          }
          const newTabData = {
            url: urlVal,
            title: val,
            favIconUrl: ""
          };
          chrome.storage.local.get(["checkpoints"], (data) => {
            const checkpointsArr = data.checkpoints || [];
            const cpIdx = checkpointsArr.findIndex(c => c.id === checkpoint.id);
            if (cpIdx !== -1) {
              checkpointsArr[cpIdx].tabs.push(newTabData);
              chrome.storage.local.set({ checkpoints: checkpointsArr }, () => {
                loadRecentCheckpoints();
              });
            }
          });
        };

        btnSubmitCustom.addEventListener("click", submitCustomLink);
        inputCustomUrl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            submitCustomLink(e);
          }
        });

        customFormRow.appendChild(inputCustomUrl);
        customFormRow.appendChild(btnSubmitCustom);

        addActionsFooter.appendChild(btnAddActiveTab);
        addActionsFooter.appendChild(customFormRow);
        dropdownList.appendChild(addActionsFooter);

        // Toggle dropdown visibility action
        const toggleDropdown = (e) => {
          if (e) e.stopPropagation();
          const isHidden = dropdownList.classList.contains("hidden");
          if (isHidden) {
            dropdownList.classList.remove("hidden");
            btnToggleDropdown.classList.add("expanded");
            expandedWorkspaceIds.add(checkpoint.id);
          } else {
            dropdownList.classList.add("hidden");
            btnToggleDropdown.classList.remove("expanded");
            expandedWorkspaceIds.delete(checkpoint.id);
          }
        };

        headerClickable.addEventListener("click", toggleDropdown);

        cardContainer.appendChild(item);
        cardContainer.appendChild(dropdownList);
        recentList.appendChild(cardContainer);
      });
    });
  };

  if (workspaceSearch) {
    workspaceSearch.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      loadRecentCheckpoints();
    });
  }

  // Realtime storage listener for popup
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.checkpoints) {
      loadRecentCheckpoints();
    }
  });

  loadRecentCheckpoints();
});
