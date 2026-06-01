import styled from '@emotion/styled';

export const PanelWrapper = styled.div`
  .panel-card {
    padding: 1.15rem 1.25rem;
    margin-bottom: 1.15rem;
    background: rgba(255,255,255,0.96);
    border: 1px solid rgba(200,200,220,0.13);
    box-shadow: 0 2px 8px 0 rgba(60,60,120,0.06);
    border-radius: 1.1rem;
    transition: box-shadow 0.18s cubic-bezier(.4,0,.2,1), transform 0.14s cubic-bezier(.4,0,.2,1);
    @media (max-width: 600px) {
      padding: 1rem 0.5rem;
    }
    &:hover {
      box-shadow: 0 4px 16px 0 rgba(60,60,120,0.10);
      transform: translateY(-1px) scale(1.004);
    }
  }

  .panel-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.25rem;
    @media (max-width: 600px) {
      grid-template-columns: 1fr;
    }
  }

  .panel-metric-card {
    padding: 1.25rem;
    border-top: 3px solid var(--metric-color, #38bdf8);
    border-radius: 1rem;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    @media (max-width: 600px) {
      padding: 1rem 0.5rem;
    }
  }

  .panel-metric-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
    gap: 0.5rem;
  }

  .panel-metric-title {
    font-size: 0.85rem;
    opacity: 0.7;
    font-weight: 500;
  }

  .panel-metric-icon {
    font-size: 1.5rem;
    opacity: 0.5;
  }

  .panel-metric-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.5rem;
    word-break: break-all;
  }

  .panel-metric-label {
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-block;
    margin-bottom: 0.35rem;
  }

  .panel-metric-sub {
    font-size: 0.8rem;
    opacity: 0.75;
    margin-bottom: 0.35rem;
  }

  .panel-tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.75rem;
  }

  .panel-tag {
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    font-weight: 600;
    background: #fef3c7;
    color: #92400e;
  }

  .panel-tag.accepted {
    background: #dcfce7;
    color: #166534;
  }
  .panel-tag.rejected {
    background: #fee2e2;
    color: #991b1b;
  }

  .panel-title {
    margin: 0 0 0.85rem;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .panel-index {
    border-radius: 12px;
    padding: 0.45rem 0.7rem;
    font-weight: 700;
    font-size: 0.82rem;
    margin-left: auto;
    margin-right: 0;
    background: var(--index-bg, #dcfce7);
    color: var(--index-fg, #166534);
  }
`;
