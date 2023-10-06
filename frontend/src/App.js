// src/App.js

import React from 'react';
import { Route, BrowserRouter as Router, Switch } from 'react-router-dom';
import Registration from './components/Registration';

function App() {
  return (
    <Router>
      <div className="App">
        <Switch>
          <Route exact path="/" component={Registration} />
          {/* Add more routes as needed */}
        </Switch>
      </div>
    </Router>
  );
}

export default App;
