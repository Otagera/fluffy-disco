export type Team = {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    text: string;
  };
  crest: string;
};

export const teams: Record<string, Team> = {
  'castle': {
    id: 'castle',
    name: 'Castle FC',
    colors: { primary: '#1a5f2a', secondary: '#ffffff', text: '#ffffff' },
    crest: '🏰'
  },
  'lions': {
    id: 'lions',
    name: 'Lion City',
    colors: { primary: '#c9302c', secondary: '#ffffff', text: '#ffffff' },
    crest: '🦁'
  },
  'eagles': {
    id: 'eagles',
    name: 'Eagle United',
    colors: { primary: '#1e3a8a', secondary: '#fbbf24', text: '#ffffff' },
    crest: '🦅'
  },
  'wolves': {
    id: 'wolves',
    name: 'Wolverton',
    colors: { primary: '#374151', secondary: '#f3f4f6', text: '#ffffff' },
    crest: '🐺'
  },
  'dragons': {
    id: 'dragons',
    name: 'Dragon Peaks',
    colors: { primary: '#7f1d1d', secondary: '#000000', text: '#ffffff' },
    crest: '🐲'
  },
  'sharks': {
    id: 'sharks',
    name: 'Shark Bay',
    colors: { primary: '#0891b2', secondary: '#e0f2fe', text: '#ffffff' },
    crest: '🦈'
  }
};
