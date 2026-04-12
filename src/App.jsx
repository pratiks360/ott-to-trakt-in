import React, { useState, useRef, useEffect } from 'react';
import './index.css';

const defaultPlatforms = [
  { id: 'nfx', name: 'Netflix', package: 'nfx', listSlug: 'netflix-india' },
  { id: 'prv', name: 'Amazon Prime', package: 'prv', listSlug: 'prime-india' },
  { id: 'dhs', name: 'JioHotstar', package: 'dhs', listSlug: 'hotstar-india' },
  { id: 'zee', name: 'Zee5', package: 'zee', listSlug: 'zee5-india' },
  { id: 'snl', name: 'Sony Liv', package: 'snl', listSlug: 'sonyliv-india' },
  
  { id: 'atp', name: 'Apple TV', package: 'atp', listSlug: 'appletv-india' }
];

function App() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('traktSyncSettings');
    return saved ? JSON.parse(saved) : {
      username: '',
      clientId: '',
      clientSecret: '',
      authCode: '',
      accessToken: '',
      itemsCount: 10
    };
  });

  const [platforms, setPlatforms] = useState(() => {
    const saved = localStorage.getItem('traktSyncPlatforms');
    return saved ? JSON.parse(saved) : defaultPlatforms;
  });

  const [logs, setLogs] = useState([{ id: 1, type: 'info', text: 'Dashboard initialized. Ready to sync.' }]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [newPlatformModal, setNewPlatformModal] = useState(false);
  const [newPlatform, setNewPlatform] = useState({ name: '', package: '', listSlug: '' });

  const logEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('traktSyncSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('traktSyncPlatforms', JSON.stringify(platforms));
  }, [platforms]);

  const addLog = (text, type = 'success') => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), type, text }]);
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handlePlatformChange = (id, field, value) => {
    setPlatforms(platforms.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const deletePlatform = (id) => {
    setPlatforms(platforms.filter(p => p.id !== id));
  };

  const addPlatform = () => {
    if (!newPlatform.name || !newPlatform.package || !newPlatform.listSlug) return;
    const id = Date.now().toString();
    setPlatforms([...platforms, { id, ...newPlatform }]);
    setNewPlatform({ name: '', package: '', listSlug: '' });
    setNewPlatformModal(false);
  };

  const fetchTraktToken = async () => {
    if (settings.accessToken) {
      addLog("Reusing existing Trakt access token.", "info");
      return settings.accessToken;
    }

    addLog("Exchanging auth code for Trakt access token...", "info");
    const payload = {
      code: settings.authCode.trim(),
      client_id: settings.clientId.trim(),
      client_secret: settings.clientSecret.trim(),
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
      grant_type: "authorization_code"
    };

    const response = await fetch("https://api.trakt.tv/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      setSettings(prev => ({ ...prev, accessToken: '' }));
      throw new Error(`Trakt OAuth Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    setSettings(prev => ({ ...prev, accessToken: data.access_token }));
    addLog("Successfully acquired access token.", "success");
    return data.access_token;
  };

  const fetchJustWatchType = async (packageCode, type, count) => {
    const query = `
    query GetPopularTitles($country: Country!, $popularTitlesFilter: TitleFilter, $popularTitlesSortBy: PopularTitlesSorting! = TRENDING, $first: Int! = 40, $language: Language!) {
      popularTitles(country: $country, filter: $popularTitlesFilter, sortBy: $popularTitlesSortBy, first: $first) {
        edges { node { content(country: $country, language: $language) { title externalIds { tmdbId imdbId } } } }
      }
    }`;

    const payload = {
      operationName: "GetPopularTitles",
      variables: {
        country: "IN",
        language: "en",
        first: Number(count),
        popularTitlesFilter: { packages: [packageCode], objectTypes: [type] },
        popularTitlesSortBy: "TRENDING"
      },
      query: query
    };

    const response = await fetch("https://apis.justwatch.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`JustWatch API Error: ${response.status}`);
    const data = await response.json();
    const edges = data.data?.popularTitles?.edges || [];
    
    return edges.map(edge => {
      const content = edge.node?.content || {};
      return {
        title: content.title,
        tmdb_id: content.externalIds?.tmdbId,
        imdb_id: content.externalIds?.imdbId
      };
    }).filter(m => m.tmdb_id || m.imdb_id);
  };

  const pushToTrakt = async (movies, shows, listSlug, accessToken) => {
    addLog(`Preparing to sync Trakt list: '${listSlug}'...`, "info");
    
    const reqHeaders = {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": settings.clientId,
      "Authorization": `Bearer ${accessToken}`
    };

    const baseUrl = `https://api.trakt.tv/users/${settings.username.trim()}/lists/${listSlug.trim()}/items`;

    try {
      addLog(`Checking for existing items to clear...`, "info");
      const getRes = await fetch(baseUrl, { method: "GET", headers: reqHeaders });
      
      if (getRes.status === 404) {
        throw new Error(`List '${listSlug}' not found. Please create it on Trakt first.`);
      } else if (getRes.status === 401) {
         setSettings(prev => ({ ...prev, accessToken: '' }));
         throw new Error(`Trakt OAuth Token Expired. Please get a new Auth Code in Settings.`);
      } else if (!getRes.ok) {
        throw new Error(`Failed to fetch current list. Code: ${getRes.status}`);
      }

      const existingItems = await getRes.json();
      
      if (existingItems && existingItems.length > 0) {
        addLog(`Found ${existingItems.length} old items. Clearing list...`, "info");
        
        const removePayload = { movies: [], shows: [] };
        existingItems.forEach(item => {
          if (item.type === 'movie' && item.movie) removePayload.movies.push({ ids: item.movie.ids });
          if (item.type === 'show' && item.show) removePayload.shows.push({ ids: item.show.ids });
        });

        const removeRes = await fetch(`${baseUrl}/remove`, {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify(removePayload)
        });

        if (!removeRes.ok) {
           addLog(`Warning: Failed to clear old items perfectly. Continuing anyway...`, "error");
        } else {
           addLog(`Successfully cleared old items.`, "success");
        }
      } else {
        addLog(`List is already empty.`, "info");
      }
    } catch (e) {
      throw e; 
    }

    addLog(`Pushing fresh trending items to '${listSlug}'...`, "info");
    const formatPayload = (items) => items.map(i => {
      let ids = {};
      if (i.tmdb_id) ids.tmdb = i.tmdb_id;
      else if (i.imdb_id) ids.imdb = i.imdb_id;
      return { ids };
    });

    const addResponse = await fetch(baseUrl, {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify({ 
        movies: formatPayload(movies),
        shows: formatPayload(shows)
      })
    });

    if (!addResponse.ok) {
      const errText = await addResponse.text();
      throw new Error(`Trakt API Error ${addResponse.status}: ${errText}`);
    }

    const result = await addResponse.json();
    const addedMovies = result.added?.movies || 0;
    const addedShows = result.added?.shows || 0;
    addLog(`Success on ${listSlug}! Added ${addedMovies} Movies and ${addedShows} Shows.`, "success");
  };

  const doSyncPlatform = async (platform, token) => {
    addLog(`Fetching top ${settings.itemsCount} Movies for ${platform.name}...`, "info");
    const movies = await fetchJustWatchType(platform.package, "MOVIE", settings.itemsCount);
    
    addLog(`Fetching top ${settings.itemsCount} TV Shows for ${platform.name}...`, "info");
    const shows = await fetchJustWatchType(platform.package, "SHOW", settings.itemsCount);

    if (movies.length > 0 || shows.length > 0) {
      await pushToTrakt(movies, shows, platform.listSlug, token);
    } else {
      addLog(`No content found for ${platform.name} to sync.`, "info");
    }
  };

  const validateSync = () => {
    if (!settings.username.trim() || !settings.clientId.trim()) {
      addLog("Error: Username and Client ID are missing. Please check Settings.", "error");
      setShowSettings(true);
      return false;
    }
    if (!settings.accessToken && (!settings.clientSecret.trim() || !settings.authCode.trim())) {
      addLog("Error: Setup Client Secret and Auth Code in Settings to map credentials first.", "error");
      setShowSettings(true);
      return false;
    }
    return true;
  };

  const syncPlatform = async (platform) => {
    if (!validateSync()) return;
    setIsSyncing(true);
    addLog(`Starting sync for ${platform.name}...`, "info");
    try {
      const token = await fetchTraktToken();
      await doSyncPlatform(platform, token);
    } catch (error) {
      addLog(`ERROR: ${error.message}`, "error");
    } finally {
      setIsSyncing(false);
      addLog(`Workflow for ${platform.name} completed.`, "info");
    }
  };

  const syncAllPlatforms = async () => {
    if (!validateSync()) return;
    setIsSyncing(true);
    addLog(`Starting global sync for all ${platforms.length} platforms...`, "info");
    try {
      const token = await fetchTraktToken();
      for (const platform of platforms) {
        addLog(`=== Syncing ${platform.name} ===`, "info");
        try {
          await doSyncPlatform(platform, token);
        } catch (err) {
          addLog(`Error syncing ${platform.name}: ${err.message}`, "error");
        }
      }
      addLog(`Global sync completed perfectly!`, "success");
    } catch (error) {
      addLog(`GLOBAL ERROR: ${error.message}`, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>🎬 Multi-Platform Trakt Sync</h1>
        <button className="settings-btn" onClick={() => setShowSettings(true)}>
          ⚙️ Settings
        </button>
      </header>

      <section className="platforms-section">
        <div className="platforms-header">
          <h2>Stream Integrations</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="add-platform-btn" style={{ background: '#3b82f6', opacity: isSyncing ? 0.7 : 1 }} onClick={syncAllPlatforms} disabled={isSyncing}>🔄 Sync All</button>
            <button className="add-platform-btn" onClick={() => setNewPlatformModal(true)}>+ Add Platform</button>
          </div>
        </div>

        <div className="platforms-grid">
          {platforms.map(platform => (
            <div key={platform.id} className="platform-card glass-panel">
              <div className="card-top">
                <h3>{platform.name}</h3>
                <button className="delete-btn" onClick={() => deletePlatform(platform.id)}>🗑️</button>
              </div>
              
              <div className="form-group small">
                <label>JustWatch Package Code</label>
                <input 
                  type="text" 
                  value={platform.package} 
                  onChange={(e) => handlePlatformChange(platform.id, 'package', e.target.value)}
                />
              </div>

              <div className="form-group small">
                <label>Target Trakt List Slug</label>
                <input 
                  type="text" 
                  value={platform.listSlug} 
                  onChange={(e) => handlePlatformChange(platform.id, 'listSlug', e.target.value)}
                />
              </div>

              <button 
                className="sync-btn platform-sync" 
                disabled={isSyncing} 
                onClick={() => syncPlatform(platform)}
              >
                {isSyncing ? "Syncing..." : "Sync to Trakt"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="glass-panel log-panel">
        <div className="log-header">Global Sync Terminal</div>
        <div className="log-content full">
          {logs.map(log => (
            <p key={log.id} className={log.type}>
              <span style={{ opacity: 0.5, marginRight: '8px' }}>&gt;</span>
              {log.text}
            </p>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h2>Global Trakt Authorization</h2>
            <p className="modal-desc">Your credentials map automatically to browser storage.</p>
            
            <div className="form-group">
              <label>Trakt Username</label>
              <input type="text" name="username" value={settings.username} onChange={handleSettingsChange} />
            </div>

            <div className="form-group">
              <label>Trakt Client ID</label>
              <input type="password" name="clientId" value={settings.clientId} onChange={handleSettingsChange} />
            </div>

            <div className="form-group">
              <label>Trakt Client Secret</label>
              <input type="password" name="clientSecret" value={settings.clientSecret} onChange={handleSettingsChange} />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Trakt Authorization Code</span>
                {settings.clientId.trim() && (
                  <a 
                    href={`https://trakt.tv/oauth/authorize?response_type=code&client_id=${settings.clientId.trim()}&redirect_uri=urn:ietf:wg:oauth:2.0:oob`}
                    target="_blank" rel="noopener noreferrer" className="accent-link"
                  >
                    Get PIN / Auth Code &rarr;
                  </a>
                )}
              </label>
              <input type="password" name="authCode" placeholder="Paste the PIN here" value={settings.authCode} onChange={handleSettingsChange} />
            </div>

            <div className="form-group">
              <label>Items to Fetch (Per Type: Movies / TV Shows)</label>
              <input type="number" name="itemsCount" value={settings.itemsCount} onChange={handleSettingsChange} min="1" max="100" />
            </div>

            <div className="modal-actions">
               <button className="sync-btn" onClick={() => setShowSettings(false)}>Close & Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {newPlatformModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <h2>Add Custom OTT Platform</h2>
            <div className="form-group">
              <label>Platform Name</label>
              <input type="text" placeholder="e.g. Hulu" value={newPlatform.name} onChange={e => setNewPlatform({ ...newPlatform, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>JustWatch Shortcode</label>
              <input type="text" placeholder="e.g. hlu" value={newPlatform.package} onChange={e => setNewPlatform({ ...newPlatform, package: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Trakt Content List Slug</label>
              <input type="text" placeholder="e.g. hulu-list" value={newPlatform.listSlug} onChange={e => setNewPlatform({ ...newPlatform, listSlug: e.target.value })} />
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '1rem' }}>
              <button className="sync-btn" onClick={addPlatform}>Add Integration</button>
              <button className="sync-btn" style={{ background: 'transparent', border: '1px solid var(--text-secondary)'}} onClick={() => setNewPlatformModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
