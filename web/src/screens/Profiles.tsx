import { Delete, Lock, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteProfile, newProfile, PROFILE_AVATARS, PROFILE_COLORS, profiles as profilesStore, saveProfile, selectProfile, useStore, type Profile } from '../data/store';
import { Pill, ProfileAvatar, Toggle } from '../ui/components';
import { Sheet } from '../ui/Sheet';

/** Netflix-style "Who's watching?" screen. */
export function ProfilePicker() {
  const profiles = useStore(profilesStore);
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [unlocking, setUnlocking] = useState<{ profile: Profile; forEdit: boolean } | null>(null);

  const tap = (p: Profile) => {
    if (p.pin) setUnlocking({ profile: p, forEdit: managing });
    else if (managing) setEditing(p);
    else selectProfile(p);
  };

  return (
    <main className="picker">
      <h1 className="display page-title">{managing ? 'Manage profiles' : "Who's watching?"}</h1>
      <div className="profile-grid">
        {profiles.map((p) => (
          <button key={p.id} className="profile-tile press" onClick={() => tap(p)}>
            <span className="face">
              <ProfileAvatar profile={p} size={104} />
              {managing && (
                <span className="edit">
                  <Pencil size={34} />
                </span>
              )}
              {p.pin && (
                <span className="lock">
                  <Lock size={16} />
                </span>
              )}
            </span>
            <span className="n">{p.name || 'Profile'}</span>
            {p.kids && <Pill tone="lime">KIDS</Pill>}
          </button>
        ))}
        {profiles.length < 6 && (
          <button className="profile-tile press" onClick={() => setEditing(newProfile(false))}>
            <span className="add">
              <Plus size={40} />
            </span>
            <span className="n muted">Add profile</span>
          </button>
        )}
      </div>
      <button className={`btn press ${managing ? 'white' : 'outline'}`} style={{ marginTop: 40 }} onClick={() => setManaging(!managing)}>
        {managing ? 'Done' : 'Manage profiles'}
      </button>

      {editing && (
        <ProfileEditor
          profile={editing}
          isNew={!profiles.some((p) => p.id === editing.id)}
          canDelete={profiles.length > 1 && profiles.some((p) => p.id === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
      {unlocking && (
        <PinDialog
          title={`Enter ${unlocking.profile.name}'s PIN`}
          check={(pin) => pin === unlocking.profile.pin}
          onClose={() => setUnlocking(null)}
          onSuccess={() => {
            const { profile, forEdit } = unlocking;
            setUnlocking(null);
            if (forEdit) setEditing(profile);
            else selectProfile(profile);
          }}
        />
      )}
    </main>
  );
}

export function ProfileEditor({ profile, isNew, canDelete, onClose }: { profile: Profile; isNew: boolean; canDelete: boolean; onClose: () => void }) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [color, setColor] = useState(profile.color);
  const [kids, setKids] = useState(!!profile.kids);
  const [pin, setPin] = useState(profile.pin ?? '');
  const [settingPin, setSettingPin] = useState(false);
  const draft: Profile = { ...profile, name: name.trim().slice(0, 16), avatar, color, kids, pin: pin || undefined };
  const valid = draft.name.length > 0;

  return (
    <Sheet onClose={onClose} surface label={isNew ? 'New profile' : 'Edit profile'}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <ProfileAvatar profile={draft} size={96} />
        <input
          className="field"
          style={{ marginTop: 18 }}
          value={name}
          maxLength={16}
          placeholder="Profile name"
          onChange={(e) => setName(e.target.value)}
          aria-label="Profile name"
          autoFocus={isNew}
        />
        <div className="sheet-label">Avatar</div>
        <div className="avatar-pick">
          {PROFILE_AVATARS.map((a) => (
            <button key={a} className={`press ${a === avatar ? 'on' : ''}`} onClick={() => setAvatar(a)} aria-label={`Avatar ${a}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="sheet-label">Colour</div>
        <div className="color-pick" style={{ alignSelf: 'flex-start' }}>
          {PROFILE_COLORS.map(([a, b], i) => (
            <button
              key={i}
              className={`press ${i === color ? 'on' : ''}`}
              style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
              onClick={() => setColor(i)}
              aria-label={`Colour ${i + 1}`}
            />
          ))}
        </div>
        <div style={{ height: 18 }} />
        <Toggle title="Kids profile" subtitle="Only kids, animation and family channels plus cartoons." checked={kids} onChange={setKids} />
        <div style={{ height: 10 }} />
        <Toggle
          title="Profile lock"
          subtitle={pin ? 'Locked with a PIN.' : 'Ask for a 4-digit PIN before opening this profile.'}
          checked={!!pin}
          onChange={(on) => (on ? setSettingPin(true) : setPin(''))}
        />
        <button
          className="btn block press"
          style={{ marginTop: 24, background: valid ? 'var(--brand)' : 'rgb(255 255 255 / 0.2)', color: '#fff' }}
          disabled={!valid}
          onClick={() => {
            saveProfile(draft);
            onClose();
          }}
        >
          {isNew ? 'Create profile' : 'Save'}
        </button>
        {canDelete && (
          <button
            className="link press"
            style={{ marginTop: 10, fontSize: 14, padding: 12 }}
            onClick={() => {
              deleteProfile(profile);
              onClose();
            }}
          >
            Delete profile
          </button>
        )}
      </div>
      {settingPin && (
        <PinDialog
          title="Choose a 4-digit PIN"
          check={() => true}
          onClose={() => setSettingPin(false)}
          onSuccess={(p) => {
            setPin(p);
            setSettingPin(false);
          }}
        />
      )}
    </Sheet>
  );
}

/** Four-dot PIN entry with a chunky keypad; shakes on a wrong PIN. Number keys work too. */
export function PinDialog({ title, check, onClose, onSuccess }: { title: string; check: (pin: string) => boolean; onClose: () => void; onSuccess: (pin: string) => void }) {
  const [entered, setEntered] = useState('');
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (entered.length !== 4) return;
    if (check(entered)) onSuccess(entered);
    else {
      setShake((s) => s + 1);
      setEntered('');
    }
  }, [entered]);

  const press = (k: string) => setEntered((e) => (k === '⌫' ? e.slice(0, -1) : e.length < 4 ? e + k : e));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Escape') onClose();
      else return;
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="backdrop" style={{ zIndex: 50, alignItems: 'center' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pin-card" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          {title}
        </h2>
        <div key={shake} className={`pin-dots ${shake ? 'shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={i < entered.length ? 'on' : ''} />
          ))}
        </div>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
            k ? (
              <button key={i} className="press" onClick={() => press(k)} aria-label={k === '⌫' ? 'Delete' : k}>
                {k === '⌫' ? <Delete /> : k}
              </button>
            ) : (
              <span key={i} className="blank" />
            ),
          )}
        </div>
        <button className="btn press muted" style={{ marginTop: 8 }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
