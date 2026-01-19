'use client';

import { useState, useEffect } from 'react';

type ImportRecord = {
  id: number;
  filename: string;
  institution: string;
  account_type: string;
  account_id: number;
  account_name: string | null;
  goal_id: number | null;
  goal_name: string | null;
  imported_at: string;
  transaction_count: number;
  status: string;
};

type SavingsGoal = {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
};

export default function ImportHistory() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [reassigningId, setReassigningId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/imports').then((res) => res.json()),
      fetch('/api/goals').then((res) => res.json()),
    ])
      .then(([importsData, goalsData]) => {
        setImports(importsData);
        setGoals(goalsData);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error loading data:', error);
        setLoading(false);
      });
  }, []);

  const handleReassignGoal = async (importId: number, newGoalId: number | null) => {
    setMessage('');
    setReassigningId(importId);

    try {
      const response = await fetch('/api/imports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: importId,
          goal_id: newGoalId,
        }),
      });

      if (response.ok) {
        const updatedImport = await response.json();
        setImports(imports.map((i) => (i.id === importId ? updatedImport : i)));
        setMessage('Goal reassigned successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error reassigning goal');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error reassigning goal');
    } finally {
      setReassigningId(null);
    }
  };

  const handleDeleteImport = async (importId: number, filename: string, transactionCount: number) => {
    if (!confirm(`Delete import "${filename}"?\n\nThis will delete ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''} from this import. Are you sure?`)) {
      return;
    }

    setMessage('');

    try {
      const response = await fetch(`/api/imports?id=${importId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setImports(imports.filter((i) => i.id !== importId));
        setMessage('Import deleted successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error deleting import');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error deleting import');
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Import History</h1>
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Import History</h1>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes('successfully')
              ? 'bg-positive/10 border border-positive/20 text-positive'
              : 'bg-negative/10 border border-negative/20 text-negative'
          }`}
        >
          {message}
        </div>
      )}

      <section className="bg-surface border border-border rounded-xl p-6">
        {imports.length === 0 ? (
          <p className="text-secondary">
            No imports found. Import a statement to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {imports.map((importRecord) => (
              <div
                key={importRecord.id}
                className="p-4 bg-elevated border border-border rounded-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-lg">{importRecord.filename}</h3>
                    <p className="text-sm text-secondary">
                      {new Date(importRecord.imported_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-sm text-tertiary mb-1">Institution</p>
                    <p className="font-medium">{importRecord.institution}</p>
                  </div>
                  <div>
                    <p className="text-sm text-tertiary mb-1">Account Type</p>
                    <p className="font-medium capitalize">{importRecord.account_type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-tertiary mb-1">Transactions</p>
                    <p className="font-medium tabular-nums">{importRecord.transaction_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-tertiary mb-1">Account</p>
                    <p className="font-medium">{importRecord.account_name || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex-1 flex items-center gap-3">
                    <label htmlFor={`goal-${importRecord.id}`} className="text-sm text-secondary whitespace-nowrap">
                      Assigned Goal:
                    </label>
                    <select
                      id={`goal-${importRecord.id}`}
                      value={importRecord.goal_id || ''}
                      onChange={(e) => {
                        const newGoalId = e.target.value ? parseInt(e.target.value) : null;
                        handleReassignGoal(importRecord.id, newGoalId);
                      }}
                      disabled={reassigningId === importRecord.id}
                      className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-border disabled:opacity-50"
                    >
                      <option value="">None</option>
                      {goals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => handleDeleteImport(importRecord.id, importRecord.filename, importRecord.transaction_count)}
                    className="px-4 py-2 bg-negative/10 border border-negative/20 text-negative text-sm rounded-lg hover:bg-negative/20 transition whitespace-nowrap"
                  >
                    Delete Import
                  </button>
                </div>

                {importRecord.goal_name && (
                  <p className="text-xs text-tertiary mt-2">
                    Currently linked to: {importRecord.goal_name}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
