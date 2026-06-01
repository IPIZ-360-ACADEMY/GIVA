import styled from '@emotion/styled';

export const PanelCard = styled.div`
  padding: 1.15rem 1.25rem;
  border-radius: 1.1rem;
  background: rgba(255,255,255,0.96);
  min-width: 0;
  box-shadow: 0 2px 8px 0 rgba(60,60,120,0.06);
  border: 1px solid rgba(200,200,220,0.13);
  border-top: 3px solid var(--metric-color, #38bdf8);
  transition: box-shadow 0.18s cubic-bezier(.4,0,.2,1), transform 0.14s cubic-bezier(.4,0,.2,1);
  @media (max-width: 600px) {
    padding: 1rem 0.5rem;
  }
  &:hover {
    box-shadow: 0 4px 16px 0 rgba(60,60,120,0.10);
    transform: translateY(-1px) scale(1.004);
  }
`;

export const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  gap: 0.5rem;
`;

export const PanelTitle = styled.span`
  font-size: 0.85rem;
  opacity: 0.7;
  font-weight: 500;
`;

export const PanelIcon = styled.span`
  font-size: 1.5rem;
  opacity: 0.5;
`;

export const PanelValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 0.5rem;
  word-break: break-all;
`;

export const PanelLabel = styled.div`
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  display: inline-block;
  margin-bottom: 0.35rem;
`;

export const PanelSub = styled.div`
  font-size: 0.8rem;
  opacity: 0.75;
  margin-bottom: 0.35rem;
`;

export const PanelTags = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
`;

export const PanelTag = styled.span`
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-weight: 600;
  background: ${props => props.variant === 'accepted' ? '#dcfce7' : props.variant === 'rejected' ? '#fee2e2' : '#fef3c7'};
  color: ${props => props.variant === 'accepted' ? '#166534' : props.variant === 'rejected' ? '#991b1b' : '#92400e'};
`;

export const PanelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

export const PanelSectionTitle = styled.h4`
  margin: 0 0 0.85rem;
  font-size: 0.95rem;
  font-weight: 700;
`;

export const PanelBox = styled.div`
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.5rem;
`;
