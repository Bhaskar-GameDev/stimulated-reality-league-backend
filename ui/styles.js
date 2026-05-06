module.exports = `
    :root {
      --primary: #1e40af;
      --primary-light: #3b82f6;
      --primary-dark: #1e3a8a;
      --secondary: #059669;
      --accent: #f59e0b;
      --danger: #dc2626;
      --warning: #d97706;
      --success: #16a34a;
      --info: #0891b2;
      --dark: #0f172a;
      --light: #f8fafc;
      --gray-50: #f8fafc;
      --gray-100: #f1f5f9;
      --gray-200: #e2e8f0;
      --gray-300: #cbd5e1;
      --gray-400: #94a3b8;
      --gray-500: #64748b;
      --gray-600: #475569;
      --gray-700: #334155;
      --gray-800: #1e293b;
      --gray-900: #0f172a;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      --border-radius: 12px;
      --border-radius-lg: 16px;
      --border-radius-xl: 24px;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, var(--dark) 0%, #1e293b 50%, var(--primary-dark) 100%),
                  url("/background.jpg") center/cover no-repeat fixed;
      background-blend-mode: overlay;
      color: var(--light);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: var(--border-radius-xl);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: var(--shadow-lg);
    }

    .header-content h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 800;
      background: linear-gradient(135deg, var(--light) 0%, var(--primary-light) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.02em;
    }

    .header-content p {
      margin: 0.5rem 0 0;
      color: var(--gray-300);
      font-size: 1.1rem;
      font-weight: 400;
    }

    .status-badge {
      padding: 0.75rem 1.5rem;
      border-radius: 50px;
      font-weight: 600;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-badge.idle { background: var(--gray-600); color: var(--gray-200); }
    .status-badge.running { background: var(--success); color: white; box-shadow: 0 0 20px rgba(22, 163, 74, 0.3); }
    .status-badge.paused { background: var(--warning); color: white; }
    .status-badge.completed { background: var(--info); color: white; }
    .status-badge.scheduled { background: var(--primary); color: white; }
    .status-badge.cancelled, .status-badge.aborted { background: var(--danger); color: white; }
    .status-badge.failed, .status-badge.waiting { background: var(--gray-500); color: white; }

    .dashboard {
      display: grid;
      grid-template-columns: 1.7fr 1fr;
      gap: 2rem;
      flex: 1;
      align-items: start;
    }

    .primary-column,
    .secondary-column {
      display: grid;
      gap: 1.5rem;
    }

    .card.highlight {
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.08), rgba(255, 255, 255, 0.98));
      border-color: rgba(59, 130, 246, 0.24);
      box-shadow: 0 30px 60px rgba(59, 130, 246, 0.08);
    }

    .card-description {
      margin: 0 0 1.5rem;
      color: var(--gray-600);
      line-height: 1.8;
      font-size: 1rem;
    }

    .form-grid {
      display: grid;
      gap: 1rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .match-card-list {
      display: grid;
      gap: 1rem;
    }

    .match-card {
      background: var(--gray-50);
      padding: 1rem 1.25rem;
      border-radius: var(--border-radius-lg);
      border: 1px solid var(--gray-200);
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.75rem;
      align-items: center;
    }

    .match-card h4 {
      margin: 0;
      font-size: 1rem;
      color: var(--dark);
      font-weight: 700;
    }

    .match-card p {
      margin: 0.35rem 0;
      color: var(--gray-700);
      font-size: 0.95rem;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .pill.scheduled { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
    .pill.completed { background: rgba(16, 185, 129, 0.12); color: #047857; }
    .pill.running { background: rgba(16, 185, 129, 0.16); color: #047857; }
    .pill.paused { background: rgba(234, 179, 8, 0.16); color: #b45309; }
    .pill.cancelled { background: rgba(239, 68, 68, 0.14); color: #b91c1c; }

    .match-card button {
      min-width: 120px;
      justify-self: end;
    }

    .card.small-card {
      padding: 1.5rem;
    }

    @media (max-width: 1100px) {
      .dashboard {
        grid-template-columns: 1fr;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: var(--border-radius-xl);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: var(--shadow-2xl);
      padding: 2rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--primary), var(--secondary), var(--accent));
    }

    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 32px 64px rgba(0, 0, 0, 0.15);
    }

    .card-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 1.5rem;
      color: var(--dark);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .card-title::before {
      content: '>';
      font-size: 1.2em;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      font-weight: 600;
      color: var(--gray-700);
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
    }

    .form-control {
      width: 100%;
      padding: 0.875rem 1rem;
      border: 2px solid var(--gray-200);
      border-radius: var(--border-radius);
      font-size: 1rem;
      background: white;
      transition: all 0.2s ease;
      color: var(--dark);
    }

    .form-control:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      transform: translateY(-1px);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      border: none;
      border-radius: var(--border-radius);
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      min-height: 48px;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(30, 64, 175, 0.3);
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(30, 64, 175, 0.4);
    }

    .btn-secondary {
      background: linear-gradient(135deg, var(--gray-500) 0%, var(--gray-600) 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(100, 116, 139, 0.3);
    }

    .btn-secondary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(100, 116, 139, 0.4);
    }

    .btn-danger {
      background: linear-gradient(135deg, var(--danger) 0%, #ef4444 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);
    }

    .btn-danger:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(220, 38, 38, 0.4);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .btn-full {
      width: 100%;
    }

    .lineups {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-top: 2rem;
    }

    .lineup {
      background: var(--gray-50);
      border-radius: var(--border-radius-lg);
      padding: 1.5rem;
      border: 1px solid var(--gray-200);
    }

    .lineup h3 {
      margin: 0 0 1rem;
      color: var(--dark);
      font-size: 1.2rem;
      font-weight: 600;
    }

    .lineup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .lineup-header h3 {
      margin: 0;
    }

    .lineup ul {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 420px;
      overflow-y: auto;
      display: grid;
      gap: 0.65rem;
    }

    .lineup li {
      padding: 0;
      border-bottom: none;
    }

    .player-option label {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.85rem 0.95rem;
      border: 1px solid var(--gray-200);
      border-radius: var(--border-radius);
      background: white;
      cursor: pointer;
      transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    }

    .player-option label:hover {
      border-color: var(--primary-light);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .player-option input {
      margin-top: 0.2rem;
      accent-color: var(--primary);
      transform: scale(1.1);
    }

    .player-details {
      display: grid;
      gap: 0.2rem;
    }

    .player-name {
      color: var(--dark);
      font-weight: 700;
    }

    .player-meta {
      color: var(--gray-500);
      font-size: 0.85rem;
      text-transform: capitalize;
    }

    .selection-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      background: var(--gray-200);
      color: var(--gray-700);
      white-space: nowrap;
    }

    .selection-count.valid {
      background: rgba(22, 163, 74, 0.14);
      color: #15803d;
    }

    .selection-count.invalid {
      background: rgba(220, 38, 38, 0.12);
      color: #b91c1c;
    }

    .match-info {
      background: linear-gradient(135deg, var(--gray-50) 0%, white 100%);
      border-radius: var(--border-radius-lg);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid var(--gray-200);
    }

    .match-info p {
      margin: 0.5rem 0;
      color: var(--gray-700);
      font-weight: 500;
    }

    .match-info strong {
      color: var(--dark);
      font-weight: 700;
    }

    .control-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.75rem;
    }

    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
      background: white;
      border-radius: var(--border-radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow);
    }

    .schedule-table th,
    .schedule-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid var(--gray-100);
    }

    .schedule-table th {
      background: var(--gray-50);
      font-weight: 700;
      color: var(--dark);
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .schedule-table tbody tr {
      transition: all 0.2s ease;
    }

    .schedule-table tbody tr:hover {
      background: var(--gray-50);
      transform: translateX(4px);
    }

    .schedule-table .badge {
      padding: 0.375rem 0.75rem;
      border-radius: 50px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .log-container {
      background: var(--dark);
      border-radius: var(--border-radius-lg);
      padding: 1.5rem;
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid var(--gray-700);
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    }

    .log-entry {
      margin-bottom: 0.75rem;
      padding: 0.5rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: var(--border-radius);
      border-left: 3px solid var(--primary);
      font-size: 0.9rem;
      line-height: 1.4;
      animation: slideIn 0.3s ease-out;
    }

    .log-entry:last-child {
      margin-bottom: 0;
    }

    .note {
      color: var(--gray-400);
      font-size: 0.9rem;
      font-style: italic;
      margin-top: 1rem;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .loading {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .loading::after {
      content: '';
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }

      .header {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }

      .dashboard {
        grid-template-columns: 1fr;
      }

      .lineups {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .control-buttons {
        grid-template-columns: 1fr;
      }

      .schedule-table {
        font-size: 0.9rem;
      }

      .schedule-table th,
      .schedule-table td {
        padding: 0.75rem 0.5rem;
      }
    }
`;

