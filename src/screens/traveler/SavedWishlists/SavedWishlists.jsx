import { useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, Check, ChevronDown, Heart, MapPin, MoreHorizontal, PencilLine, Plus, RefreshCw, X } from 'lucide-react'
import { experiences, providers } from '../../../data/mockData'
import { useNavigate } from 'react-router-dom'
import TravelerTabs from '../../../components/TravelerTabs/TravelerTabs'

const seedItems = [
  { id: 'experience-1', type: 'experience', sourceId: '1', listId: 'tokyo' },
  { id: 'provider-kenji', type: 'provider', sourceId: 'kenji', listId: 'tokyo' },
  { id: 'experience-3', type: 'experience', sourceId: '3', listId: 'someday' },
  { id: 'provider-liam', type: 'provider', sourceId: 'liam', listId: null },
]
const initialLists = [{ id: 'tokyo', name: 'Tokyo Trip' }, { id: 'someday', name: 'Someday' }]

export default function SavedWishlists() {
  const navigate = useNavigate()
  const [lists, setLists] = useState(initialLists)
  const [items, setItems] = useState(seedItems)
  const [activeList, setActiveList] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [toast, setToast] = useState('')
  const [listModal, setListModal] = useState(null)
  const [listName, setListName] = useState('')
  const [listError, setListError] = useState('')
  const [menuItem, setMenuItem] = useState(null)

  useEffect(() => { const timer = window.setTimeout(() => setLoading(false), 650); return () => window.clearTimeout(timer) }, [])
  const savedItems = useMemo(() => items.map(item => {
    const source = item.type === 'experience' ? experiences.find(entry => String(entry.id) === item.sourceId) : providers.find(entry => entry.id === item.sourceId)
    return { ...item, source, title: item.type === 'experience' ? source?.title : source?.name, image: source?.image, location: source?.location, label: item.type === 'experience' ? 'Experience' : source?.subtype || 'Local expert' }
  }).filter(item => item.source), [items])
  const visibleItems = savedItems.filter(item => activeList === 'all' || item.listId === activeList)
  const activeName = activeList === 'all' ? 'All saved' : lists.find(list => list.id === activeList)?.name
  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 2800) }

  const saveList = event => {
    event.preventDefault()
    const name = listName.trim()
    if (!name || name.length > 40) return setListError('Enter a list name between 1 and 40 characters.')
    if (lists.some(list => list.name.toLowerCase() === name.toLowerCase() && list.id !== listModal?.id)) return setListError('You already have a list with this name.')
    if (listModal?.mode === 'rename') setLists(lists.map(list => list.id === listModal.id ? { ...list, name } : list))
    else { const id = `list-${Date.now()}`; setLists([...lists, { id, name }]); setActiveList(id) }
    setListModal(null); setListName(''); setListError(''); notify('List saved')
  }
  const removeItem = item => {
    setItems(previous => previous.filter(entry => entry.id !== item.id)); setMenuItem(null)
    window.setTimeout(() => { if (item.id === 'provider-liam') { setItems(previous => [...previous, { id: item.id, type: item.type, sourceId: item.sourceId, listId: item.listId }]); notify("Couldn't remove — try again.") } else notify('Removed from saved') }, 550)
  }
  const moveItem = (item, listId) => { setItems(previous => previous.map(entry => entry.id === item.id ? { ...entry, listId: listId || null } : entry)); setMenuItem(null); notify('Moved to list') }
  const retry = () => { setLoadError(false); setLoading(true); window.setTimeout(() => setLoading(false), 600) }

  return <main className="portal-page saved-page">
    <div className="saved-shell">
      <aside className="saved-rail"><div className="saved-rail-title"><BookmarkPlus size={19} /><span>My Lists</span></div><button className={activeList === 'all' ? 'active' : ''} onClick={() => setActiveList('all')}>All saved <span>{items.length}</span></button>{lists.map(list => <button key={list.id} className={activeList === list.id ? 'active' : ''} onClick={() => setActiveList(list.id)}>{list.name} <span>{items.filter(item => item.listId === list.id).length}</span></button>)}<button className="saved-rail-create" onClick={() => { setListModal({ mode: 'create' }); setListName('') }}><Plus size={16} /> New list</button></aside>
      <section className="saved-content"><header className="saved-header"><div><p className="settings-eyebrow">Your collection</p><h1>{activeName}</h1><span>Keep your favorite experiences and local experts close.</span></div><div className="saved-mobile-switcher"><select value={activeList} onChange={event => setActiveList(event.target.value)} aria-label="Select saved list"><option value="all">All saved</option>{lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select><button className="btn btn-outline btn-sm" onClick={() => { setListModal({ mode: 'create' }); setListName('') }}><Plus size={16} /> New</button></div>{activeList !== 'all' && <button className="btn btn-ghost btn-sm saved-rename" onClick={() => { const list = lists.find(entry => entry.id === activeList); setListName(list.name); setListModal({ mode: 'rename', id: list.id }) }}><PencilLine size={15} /> Rename</button>}</header>
        {loadError && <div className="inline-banner saved-error"><span>Couldn't load your saved items</span><button className="btn btn-outline btn-sm" onClick={retry}><RefreshCw size={14} /> Retry</button></div>}
        {loading ? <div className="saved-grid" aria-label="Loading saved items">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="saved-skeleton"><div /><span /><span /></div>)}</div> : visibleItems.length === 0 ? <div className="saved-empty"><Heart size={34} /><h2>Nothing saved yet</h2><p>Tap the heart icon on any experience or provider to save it here.</p><button className="btn btn-primary" onClick={() => navigate('/search')}>Explore experiences</button></div> : <div className="saved-grid">{visibleItems.map(item => <article className="saved-item" key={item.id}><button className="saved-item-link" onClick={() => navigate(item.type === 'experience' ? `/experience/${item.sourceId}` : `/provider/${item.sourceId}`)}><img src={item.image} alt="" /><div className="saved-item-overlay"><span>{item.label}</span></div><div className="saved-item-copy"><h2>{item.title}</h2><p><MapPin size={14} /> {item.location}</p></div></button><button className="icon-remove" aria-label={`Remove ${item.title} from saved`} onClick={() => removeItem(item)}><Heart size={17} fill="currentColor" /></button><button className="saved-more" aria-label={`Organize ${item.title}`} onClick={() => setMenuItem(menuItem === item.id ? null : item.id)}><MoreHorizontal size={19} /></button>{menuItem === item.id && <div className="saved-item-menu"><p>Move to list</p><button onClick={() => moveItem(item, null)}>Ungrouped</button>{lists.map(list => <button key={list.id} onClick={() => moveItem(item, list.id)}><Check size={14} opacity={item.listId === list.id ? 1 : 0} /> {list.name}</button>)}</div>}</article>)}</div>}
      </section>
    </div>
    {listModal && <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="list-modal-title"><form className="modal saved-list-modal" onSubmit={saveList}><div className="modal-header"><h3 id="list-modal-title">{listModal.mode === 'rename' ? 'Rename list' : 'Create a new list'}</h3><button type="button" aria-label="Close" onClick={() => setListModal(null)}><X size={20} /></button></div><div className="modal-body"><label className="input-group"><span className="input-label">List name</span><input className={'input-field ' + (listError ? 'error' : '')} value={listName} maxLength="40" autoFocus onChange={event => { setListName(event.target.value); setListError('') }} />{listError && <span className="input-error">{listError}</span>}</label></div><div className="modal-footer"><button className="btn btn-ghost" type="button" onClick={() => setListModal(null)}>Cancel</button><button className="btn btn-primary" type="submit">Save list</button></div></form></div>}
    {toast && <div className="toast-container"><div className="toast error">{toast}</div></div>}
    <TravelerTabs />
  </main>
}
