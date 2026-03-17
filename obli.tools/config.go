package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// AppEntry holds one registered application in Obli.tools.
type AppEntry struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	Color   string `json:"color"`   // hex, e.g. "#6366f1"
	LastURL string `json:"lastUrl,omitempty"` // last-visited path, e.g. "/agents/5"
}

// alertCache stores the last-known unread alert count per app URL.
// Updated each time the user visits an app; read by the tab bar JS to show badges.
var alertCache = map[string]int{}
var alertCacheMu sync.Mutex

// TabConfig holds the multi-tenant tab-cycling preferences for the desktop app.
// The two modes are independent and can both be active simultaneously:
//   - AutoCycle    : round-robin through all tenants every AutoCycleIntervalS seconds
//   - FollowAlerts : switch immediately to a tenant that receives a new unread alert
type TabConfig struct {
	AutoCycleEnabled    bool `json:"autoCycleEnabled"`
	AutoCycleIntervalS  int  `json:"autoCycleIntervalS"`  // seconds between automatic tenant switches
	FollowAlertsEnabled bool `json:"followAlertsEnabled"` // switch on new unread alert from another tenant
}

// Config holds all persisted user preferences.
type Config struct {
	URL         string      `json:"url"`
	Apps        []AppEntry  `json:"apps,omitempty"`        // all registered applications
	Width       int         `json:"width,omitempty"`       // last known window content width  (logical px)
	Height      int         `json:"height,omitempty"`      // last known window content height (logical px)
	DownloadDir string      `json:"downloadDir,omitempty"` // preferred folder for native file downloads
	TabConfig   TabConfig   `json:"tabConfig"`             // multi-tenant tab-bar cycling settings
}

// configPath returns the OS-appropriate path for config.json:
//   - Windows : %APPDATA%\ObliTools\config.json
//   - macOS   : ~/Library/Application Support/ObliTools/config.json
//   - Linux   : ~/.config/oblitools/config.json
func configPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "ObliTools", "config.json"), nil
}

// loadConfig reads the config file and returns the parsed Config.
// Returns an empty Config (no error) when the file does not exist yet.
func loadConfig() (*Config, error) {
	path, err := configPath()
	if err != nil {
		return &Config{}, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		// File not found on first run — not an error.
		return &Config{}, nil
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return &Config{}, nil
	}

	// Apply defaults for TabConfig
	if cfg.TabConfig.AutoCycleIntervalS <= 0 {
		cfg.TabConfig.AutoCycleIntervalS = 30
	}

	// Migrate: if URL is set but Apps is empty (existing users), seed Apps from URL.
	if cfg.URL != "" && len(cfg.Apps) == 0 {
		cfg.Apps = []AppEntry{{
			Name:  "App",
			URL:   cfg.URL,
			Color: appColorFromURL(cfg.URL),
		}}
	}

	// Always recompute app colours from URL so stale or wrong stored values
	// are fixed automatically on every launch.
	for i := range cfg.Apps {
		cfg.Apps[i].Color = appColorFromURL(cfg.Apps[i].URL)
	}

	return &cfg, nil
}

// saveConfig persists the Config to disk.
func saveConfig(cfg *Config) error {
	path, err := configPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o600)
}
