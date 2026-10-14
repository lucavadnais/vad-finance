<script setup lang="ts">
// Terms of use (/terms), public.
import { RouterLink } from 'vue-router';
import { LEGAL } from '@/lib/legal';
import LegalPage from '@/components/LegalPage.vue';
</script>

<template>
  <LegalPage title="Conditions d'utilisation">
    <p>
      Les présentes conditions encadrent l'utilisation de {{ LEGAL.app }} (« l'application »), exploitée par
      {{ LEGAL.owner }}. En vous connectant à l'application, vous les acceptez.
    </p>

    <h2>1. Le service</h2>
    <p>
      L'application vous aide à suivre vos comptes, vos transactions, votre budget et vos prévisions. C'est un outil
      d'organisation : elle ne fournit aucun conseil financier, fiscal ou juridique, et n'est reliée à aucune
      institution financière. Les soldes, budgets, prévisions et comparaisons qu'elle affiche sont calculés à partir des
      données que vous fournissez et sont des estimations.
    </p>

    <h2>2. Votre compte</h2>
    <p>
      Vous vous connectez avec votre compte Google, et vous êtes responsable de sa sécurité. Votre compte est personnel
      : n'y donnez pas accès à d'autres personnes.
    </p>

    <h2>3. Vos données</h2>
    <p>
      Les données que vous entrez ou importez vous appartiennent. Vous nous autorisez seulement à les conserver et à les
      traiter pour vous fournir l'application, comme le décrit notre
      <RouterLink to="/privacy">politique de confidentialité</RouterLink>. Vous êtes responsable de leur exactitude,
      notamment lors de l'import de relevés; vérifiez-les auprès de votre institution financière avant de prendre une
      décision importante.
    </p>

    <h2>4. Utilisation acceptable</h2>
    <p>Vous vous engagez à ne pas :</p>
    <ul>
      <li>utiliser l'application à des fins illégales;</li>
      <li>tenter d'accéder aux données d'autres utilisateurs ou de contourner la sécurité du service;</li>
      <li>perturber le service, par exemple en le surchargeant de requêtes automatisées.</li>
    </ul>

    <h2>5. Disponibilité</h2>
    <p>
      L'application est fournie telle quelle. Nous faisons de notre mieux pour qu'elle fonctionne bien, mais elle peut
      être interrompue, lente au démarrage ou modifiée, sans préavis. Nous vous recommandons de conserver vos relevés
      bancaires originaux.
    </p>

    <h2>6. Responsabilité</h2>
    <p>
      Dans la mesure permise par la loi, nous ne sommes pas responsables des décisions prises sur la base des
      informations affichées par l'application, ni des pertes de données ou interruptions de service. Rien dans les
      présentes conditions ne limite les droits que vous accorde la loi, notamment la Loi sur la protection du
      consommateur du Québec.
    </p>

    <h2>7. Fin de l'utilisation</h2>
    <p>
      Vous pouvez cesser d'utiliser l'application et supprimer votre compte à tout moment, dans
      <strong>Paramètres → Profil</strong>. Nous pouvons suspendre ou fermer un compte qui ne respecte pas ces
      conditions.
    </p>

    <h2>8. Modifications</h2>
    <p>
      Nous pouvons modifier ces conditions. La date en haut de la page indique leur dernière mise à jour; en cas de
      changement important, nous vous en informerons dans l'application.
    </p>

    <h2>9. Droit applicable</h2>
    <p>Ces conditions sont régies par les lois du Québec et les lois du Canada qui s'y appliquent.</p>

    <h2>10. Nous joindre</h2>
    <p>Pour toute question : {{ LEGAL.contactEmail }}</p>
  </LegalPage>
</template>
