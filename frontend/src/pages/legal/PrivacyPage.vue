<script setup lang="ts">
// Privacy policy (/privacy), public. Says what the app really does: keep it in
// line with the code (data stored, cookie, providers, account deletion).
import { RouterLink } from 'vue-router';
import { LEGAL } from '@/lib/legal';
import LegalPage from '@/components/LegalPage.vue';
</script>

<template>
  <LegalPage title="Politique de confidentialité">
    <p>
      {{ LEGAL.app }} (« l'application ») est une application de gestion de finances personnelles exploitée par
      {{ LEGAL.owner }}. Cette politique explique quels renseignements personnels nous recueillons, pourquoi, comment
      nous les protégeons et quels sont vos droits, conformément à la Loi sur la protection des renseignements
      personnels dans le secteur privé du Québec.
    </p>

    <h2>1. Renseignements que nous recueillons</h2>
    <ul>
      <li>
        <strong>Votre compte Google</strong>, lorsque vous vous connectez : votre nom, votre adresse courriel, votre
        photo de profil et l'identifiant unique de votre compte Google. Nous ne recevons jamais votre mot de passe et
        n'avons accès ni à vos courriels, ni à vos fichiers, ni à vos contacts.
      </li>
      <li>
        <strong>Les données que vous entrez ou importez</strong> : vos comptes (nom, type, solde, image facultative),
        vos transactions (date, description, montant, catégorie), saisies à la main ou importées d'un relevé CSV, vos
        catégories, groupes, prévisions et paramètres.
      </li>
      <li><strong>Un cookie de session</strong>, qui vous garde connecté (voir la section 3).</li>
    </ul>
    <p>
      L'application n'est pas reliée à votre banque : elle ne vous demande ni identifiants bancaires, ni numéros de
      carte, et ne peut faire aucune opération sur vos comptes.
    </p>

    <h2>2. Pourquoi nous les utilisons</h2>
    <p>
      Uniquement pour vous fournir l'application : vous identifier, enregistrer vos données et vous afficher vos soldes,
      votre budget et vos analyses. Nous ne vendons pas vos renseignements, ne les utilisons pas à des fins
      publicitaires et ne les communiquons à personne, sauf aux fournisseurs nécessaires au fonctionnement du service
      (section 4) ou lorsque la loi l'exige.
    </p>

    <h2>3. Cookies et stockage dans votre navigateur</h2>
    <ul>
      <li>
        <strong>Cookie de session</strong> (<code>sid</code>) : essentiel à la connexion. Il est illisible par les
        scripts de la page, n'est envoyé qu'à notre serveur et expire après 30 jours sans utilisation.
      </li>
      <li>
        <strong>Stockage local</strong> : votre préférence d'affichage « masquer les montants », conservée seulement
        dans votre navigateur.
      </li>
    </ul>
    <p>
      Nous n'utilisons aucun outil de statistiques, de publicité ou de suivi. Le bouton « Se connecter avec Google » est
      fourni par Google, qui peut utiliser ses propres cookies selon sa politique de confidentialité.
    </p>

    <h2>4. Fournisseurs et communication à l'extérieur du Québec</h2>
    <p>Pour faire fonctionner l'application, nous faisons appel aux fournisseurs suivants :</p>
    <ul>
      <li><strong>Google</strong> : la connexion à votre compte.</li>
      <li><strong>Render</strong> : l'hébergement de l'application.</li>
      <li><strong>MongoDB Atlas</strong> : l'hébergement de la base de données où vos données sont enregistrées.</li>
    </ul>
    <p>
      Leurs serveurs peuvent être situés à l'extérieur du Québec, notamment aux États-Unis. Vos renseignements y sont
      donc communiqués et conservés, et ces fournisseurs n'y ont accès que dans la mesure nécessaire à leur service.
    </p>

    <h2>5. Sécurité</h2>
    <p>
      Les échanges avec l'application sont chiffrés (HTTPS). Seule une empreinte de votre jeton de session est
      conservée, et chaque requête est limitée à vos propres données : un utilisateur ne peut pas voir celles d'un
      autre. Aucun système n'étant parfaitement sûr, nous vous aviserons, ainsi que la Commission d'accès à
      l'information, de tout incident présentant un risque sérieux de préjudice, comme la loi le prévoit.
    </p>

    <h2>6. Conservation et suppression</h2>
    <p>
      Vos renseignements sont conservés tant que votre compte existe. Vous pouvez le supprimer à tout moment dans
      <strong>Paramètres → Profil → Supprimer mon compte</strong> : votre compte, toutes vos données et vos sessions
      sont alors effacés immédiatement et définitivement de notre base de données.
    </p>

    <h2>7. Vos droits</h2>
    <p>Vous pouvez en tout temps :</p>
    <ul>
      <li>consulter et corriger vos données, directement dans l'application;</li>
      <li>supprimer votre compte et vos données (section 6);</li>
      <li>nous demander l'accès aux renseignements que nous détenons à votre sujet, ou une copie de ceux-ci;</li>
      <li>retirer votre consentement, en cessant d'utiliser l'application et en supprimant votre compte.</li>
    </ul>
    <p>
      Pour exercer ces droits ou pour toute question, écrivez-nous (section 8). Si vous n'êtes pas satisfait de notre
      réponse, vous pouvez porter plainte auprès de la Commission d'accès à l'information du Québec.
    </p>

    <h2>8. Responsable de la protection des renseignements personnels</h2>
    <p>
      {{ LEGAL.contactName }}<br />
      Courriel : {{ LEGAL.contactEmail }}
    </p>

    <h2>9. Mineurs</h2>
    <p>L'application n'est pas destinée aux personnes de moins de 14 ans.</p>

    <h2>10. Modifications</h2>
    <p>
      Nous pouvons mettre cette politique à jour. La date en haut de la page indique sa dernière modification; en cas de
      changement important, nous vous en informerons dans l'application. Voir aussi nos
      <RouterLink to="/terms">conditions d'utilisation</RouterLink>.
    </p>
  </LegalPage>
</template>
