import { useState, useEffect } from "react";
import styles from "./CarAds.module.scss";
import { FaLocationDot } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";
import { useCookies } from "react-cookie";
import React from "react";

const CarAds = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [cookies, setCookie] = useCookies(['recentCars']);
  const [audioContext, setAudioContext] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);

  const initSound = async () => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const response = await fetch("./notification2.wav");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(arrayBuffer);
      
      setAudioContext(context);
      setAudioBuffer(buffer);
      setIsSoundEnabled(true);
      
      // Probajte odmah pustiti zvuk da "otključate" audio
      playSound();
    } catch (err) {
      console.error("Greška pri inicijalizaciji zvuka:", err);
    }
  };
  
  const playSound = () => {
    if (!isSoundEnabled || !audioContext || !audioBuffer) return;
    
    try {
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);
    } catch (err) {
      console.error("Greška pri puštanju zvuka:", err);
    }
  };

  // Učitavanje sačuvanih automobila iz cookie-a pri pokretanju
  useEffect(() => {
    const savedCars = cookies.recentCars || [];

    setCars(prev => {
      // Ako su već u stanju, ne dodaj ih ponovo
      const uniqueSaved = savedCars.filter(
        newCar => !prev.some(prevCar => prevCar.id === newCar.id)
      );
      return [...uniqueSaved, ...prev];
    });

    setLoading(false);
  }, []);

  // WebSocket konekcija i osvežavanje podataka
  useEffect(() => {
    const ws = new WebSocket('wss://67719588c3f7.ngrok.app/ws');

    ws.onopen = () => {
      console.log('WebSocket connected');
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'update') {
          setCars(prevCars => {
            // Filtriranje novih automobila
            const newCars = message.data.filter(
              newCar => !prevCars.some(prevCar => prevCar.id === newCar.id)
            );

            // Obaveštenje za nove automobile
            if (newCars.length > 0) {
              console.log("Pronađeni novi oglasi:", newCars.length);
              playSound();
            }

            // Kombinovanje i ograničavanje na 30 automobila
            const updatedCars = [...newCars, ...prevCars].slice(0, 30);

            // Čuvanje u cookie (zadnjih 10 automobila)
            setCookie('recentCars', updatedCars.slice(0, 10), {
              path: '/',
              maxAge: 604800, // 1 nedelja
              sameSite: 'strict'
            });

            return updatedCars;
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('Greška pri obradi WebSocket poruke:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError("Problem sa konekcijom. Pokušavam ponovo...");
      // Fallback na HTTP ako WebSocket ne radi
      fetchCarData();
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // Fallback funkcija ako WebSocket ne radi
    const fetchCarData = async () => {
      try {
        const response = await fetch("https://67719588c3f7.ngrok.app/cars");
        const data = await response.json();

        setCars(prev => {
          const updated = [...data, ...prev].slice(0, 30);
          setCookie('recentCars', updated.slice(0, 10), {
            path: '/',
            maxAge: 604800,
            sameSite: 'strict'
          });
          return updated;
        });
      } catch (err) {
        console.error('Fetch error:', err);
        setError("Ne mogu da dohvatim podatke");
      } finally {
        setLoading(false);
      }
    };

    // Čišćenje pri unmount-u
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [isSoundEnabled]);

  // Komponenta za prikaz automobila (optimizovana sa React.memo)
  const CarCard = React.memo(({ car }) => (
    <div className={styles.card}>
      <div className={styles.imageContainer}>
        <div
          style={{ backgroundImage: `url(${car.image})`}}
          className={styles.image}
          alt={car.title}
        />
      </div>
      <div className={styles.content}>
        <h2 className={styles.title}>{car.title}</h2>
        <div className={styles.mileage}>
          <p>{car.price}</p><h3>{car.detailedInfo?.date || 'Nepoznato'}</h3>{car.detailedInfo?.mileage || 'Nepoznato'}</div>
        <a
          href={car.googleMapsLink}
          target="_blank"
          className={styles.location}
        >
          <FaLocationDot/>{car.location}
        </a>
        <p className={styles.date}>
          {car.detailedInfo?.power || 'Nepoznato'}
        </p>
        <p className={styles.price}>
          {car.detailedInfo?.googleSearchUrlName && (
            <a className={styles.link} href={car.detailedInfo.googleSearchUrlName} target="_blank">
              Google
            </a>
          )}
          <a href={car.link} target="_blank" rel="noopener noreferrer" className={styles.link}>
            Willhaben
          </a>
        </p>
      </div>
      {car.phoneNumber ? (
        <a
          href={`tel:${car.phoneNumber}`}
          className={styles.phoneButton}
          title={`Pozovi ${car.phoneNumber}`}
        >
          📞
        </a>
      ) : (
        <button className={`${styles.phoneButton} ${styles.disabled}`} disabled title="Broj nije dostupan">
          📞
        </button>
      )}
    </div>
  ));

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Nutzfahrzeug und Pickup</h1>

      {!isSoundEnabled && (
        <button
          onClick={() => setIsSoundEnabled(true)}
          className={styles.soundButton}
        >
          Omogući zvuk obaveštenja 🔊
        </button>
      )}

      {loading && (
        <div className={styles.loadingContainer}>
          <p className={styles.loading}>Učitavanje oglasa...</p>
          {cookies.recentCars?.length > 0 && (
            <p className={styles.loadingNote}>
              Prikazujem prethodno sačuvane oglase dok se učitavaju novi
            </p>
          )}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.cards}>
        {cars.map((car) => (
          <CarCard key={car.id} car={car} />
        ))}

        {!loading && cars.length === 0 && (
          <div className={styles.noResults}>
            <p>Nema dostupnih oglasa</p>
            {cookies.recentCars?.length > 0 && (
              <button
                className={styles.showSaved}
                onClick={() => setCars(cookies.recentCars)}
              >
                Prikaži sačuvane oglase
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CarAds;
