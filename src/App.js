import './App.css';
import CarAds from './components/CarAds';
import { CookiesProvider } from 'react-cookie';

function App() {
  return (
    <CookiesProvider>
      <div className="App">
        <CarAds/>
      </div>
    </CookiesProvider>
  );
}

export default App;
