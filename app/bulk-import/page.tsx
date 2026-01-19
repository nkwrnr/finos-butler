'use client';

import { useState, useEffect } from 'react';

type FolderMapping = {
  path: string;
  institution: string;
  accountType: string;
  goalId: number | null;
  goalName: string | null;
  fileCount: number;
  files: string[];
  alreadyImportedCount?: number;
  enabled: boolean;
};

type SavingsGoal = {
  id: number;
  name: string;
};

type ImportResult = {
  filename: string;
  success: boolean;
  transactionCount?: number;
  error?: string;
};

export default function BulkImport() {
  const [statementsPath, setStatementsPath] = useState('/Users/the_machine/app/finance/Statements');
  const [mappings, setMappings] = useState<FolderMapping[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<{
    totalFiles: number;
    successCount: number;
    failCount: number;
    totalTransactions: number;
  } | null>(null);

  useEffect(() => {
    loadGoals();
    // Load saved path from localStorage
    const saved = localStorage.getItem('bulkImportPath');
    if (saved) {
      setStatementsPath(saved);
    }
  }, []);

  const loadGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      const data = await response.json();
      setGoals(data);
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setMessage('');
    setResults(null);

    try {
      const response = await fetch('/api/bulk-import-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementsPath }),
      });

      const data = await response.json();

      if (response.ok) {
        setMappings(data.mappings.map((m: FolderMapping) => ({ ...m, enabled: true })));
        localStorage.setItem('bulkImportPath', statementsPath);
        setMessage(`Found ${data.mappings.length} folders with ${data.mappings.reduce((sum: number, m: FolderMapping) => sum + m.fileCount, 0)} files to import`);
      } else {
        setMessage(data.error || 'Error scanning folders');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error scanning folders');
    } finally {
      setScanning(false);
    }
  };

  const handleImportAll = async () => {
    if (!confirm(`Import ${mappings.filter(m => m.enabled).reduce((sum, m) => sum + m.fileCount, 0)} files from ${mappings.filter(m => m.enabled).length} folders?`)) {
      return;
    }

    setImporting(true);
    setMessage('Processing imports...');
    setResults(null);

    try {
      const response = await fetch('/api/bulk-import-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.results);
        setSummary(data.summary);
        setMessage(`Import complete! ${data.summary.successCount} files imported, ${data.summary.failCount} failed`);
      } else {
        setMessage(data.error || 'Error processing imports');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error processing imports');
    } finally {
      setImporting(false);
    }
  };

  const updateMapping = (index: number, field: string, value: string | number | boolean | null) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };

    // If goal changed, update goalName
    if (field === 'goalId') {
      const goal = goals.find((g) => g.id === value);
      updated[index].goalName = goal ? goal.name : null;
    }

    setMappings(updated);
  };

  const getMessageStyle = () => {
    if (message.includes('complete') || message.includes('Found')) {
      return 'bg-positive/10 border border-positive/20 text-positive';
    }
    if (message.includes('Error')) {
      return 'bg-negative/10 border border-negative/20 text-negative';
    }
    return 'bg-surface border border-border text-secondary';
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Bulk Import</h1>

      {message && (
        <div className={`p-4 rounded-lg ${getMessageStyle()}`}>
          {message}
        </div>
      )}

      {/* Scan Section */}
      <section className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm text-secondary uppercase tracking-wide mb-4">Scan Statements Folder</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="statementsPath" className="block text-sm text-secondary mb-2">
              Statements Folder Path
            </label>
            <input
              type="text"
              id="statementsPath"
              value={statementsPath}
              onChange={(e) => setStatementsPath(e.target.value)}
              className="w-full px-4 py-2 bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
              placeholder="/Statements"
            />
            <p className="text-xs text-tertiary mt-1">
              Absolute path to your statements folder (e.g., /Users/yourname/Documents/Statements)
            </p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning || importing}
            className="px-6 py-2 bg-primary text-base rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? 'Scanning...' : 'Scan Folders'}
          </button>
        </div>
      </section>

      {/* Mappings Section */}
      {mappings.length > 0 && !results && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm text-secondary uppercase tracking-wide">Folder Mappings</h2>
            <button
              onClick={handleImportAll}
              disabled={importing || mappings.filter(m => m.enabled && m.fileCount > 0).length === 0}
              className="px-6 py-2 bg-positive text-base rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Import All'}
            </button>
          </div>

          <div className="space-y-4">
            {mappings.map((mapping, index) => (
              <div
                key={index}
                className="p-4 bg-elevated border border-border rounded-lg"
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={mapping.enabled}
                    onChange={(e) => updateMapping(index, 'enabled', e.target.checked)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-semibold">{mapping.path}</p>
                      <p className="text-sm text-secondary">
                        {mapping.fileCount} file{mapping.fileCount !== 1 ? 's' : ''} to import
                        {mapping.alreadyImportedCount && mapping.alreadyImportedCount > 0 && (
                          <span className="ml-2 text-zcash">
                            ({mapping.alreadyImportedCount} already imported)
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-tertiary mb-1">Institution</label>
                        <input
                          type="text"
                          value={mapping.institution}
                          onChange={(e) => updateMapping(index, 'institution', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-tertiary mb-1">Account Type</label>
                        <select
                          value={mapping.accountType}
                          onChange={(e) => updateMapping(index, 'accountType', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                        >
                          <option value="checking">Checking</option>
                          <option value="savings">Savings</option>
                          <option value="credit_card">Credit Card</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-tertiary mb-1">Goal (Optional)</label>
                        <select
                          value={mapping.goalId || ''}
                          onChange={(e) =>
                            updateMapping(index, 'goalId', e.target.value ? parseInt(e.target.value) : null)
                          }
                          className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border"
                        >
                          <option value="">None</option>
                          {goals.map((goal) => (
                            <option key={goal.id} value={goal.id}>
                              {goal.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Results Section */}
      {results && (
        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm text-secondary uppercase tracking-wide mb-6">Import Results</h2>

          {summary && (
            <div className="mb-6 p-4 bg-elevated border border-border rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-tertiary mb-1">Total Files</p>
                  <p className="text-2xl font-bold tabular-nums">{summary.totalFiles}</p>
                </div>
                <div>
                  <p className="text-sm text-tertiary mb-1">Successful</p>
                  <p className="text-2xl font-bold tabular-nums text-positive">{summary.successCount}</p>
                </div>
                <div>
                  <p className="text-sm text-tertiary mb-1">Failed</p>
                  <p className="text-2xl font-bold tabular-nums text-negative">{summary.failCount}</p>
                </div>
                <div>
                  <p className="text-sm text-tertiary mb-1">Transactions</p>
                  <p className="text-2xl font-bold tabular-nums">{summary.totalTransactions}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-sm ${
                  result.success
                    ? 'bg-positive/10 border border-positive/20 text-positive'
                    : 'bg-negative/10 border border-negative/20 text-negative'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{result.filename}</span>
                  {result.success ? (
                    <span className="text-xs">
                      {result.transactionCount} transaction{result.transactionCount !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs">{result.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <a
              href="/import-history"
              className="px-4 py-2 bg-primary text-base rounded-lg font-medium hover:opacity-90 transition"
            >
              View Import History
            </a>
            <button
              onClick={() => {
                setResults(null);
                setSummary(null);
                setMappings([]);
                setMessage('');
              }}
              className="px-4 py-2 bg-elevated border border-border text-secondary rounded-lg hover:text-primary transition"
            >
              Start New Import
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
