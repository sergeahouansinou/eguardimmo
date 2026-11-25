<?php

declare(strict_types=1);

use App\Modules\Identity\Security\AccountLockout;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Console\ConsoleContext as C;

beforeEach(function (): void {
    Notification::fake();
    $this->op = C::operateur(['compliance'], 'Opérateur', true, 'ops@exemple.fr');
    $this->url = '/api/v1/console/support/access/'.C::UUID_INCONNU.'/review';
});

it('laisse écrire avec un code valide après des échecs de mot de passe anonymes sur le même e-mail', function (): void {
    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE) as $essai) {
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.'.$essai])
            ->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'faux-mot-de-passe', 'code' => '000000'])
            ->assertUnprocessable();
    }

    C::ecrireBrut($this, $this->op['jeton'], 'POST', $this->url, avecPreuve($this->op['jeton']))->assertNotFound();
});

it('bloque la preuve en session après des preuves fausses répétées, même avec un code valide ensuite', function (): void {
    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE) as $essai) {
        C::ecrireBrut($this, $this->op['jeton'], 'POST', $this->url, ['two_factor_code' => '000000'])->assertUnprocessable()->assertJsonPath('code', 'operator_proof_invalid');
    }

    C::ecrireBrut($this, $this->op['jeton'], 'POST', $this->url, avecPreuve($this->op['jeton']))->assertTooManyRequests();
});

it('ne mélange pas le verrou de preuve d\'un opérateur avec celui d\'un autre', function (): void {
    $autre = C::operateur(['compliance'], 'Autre');

    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE) as $essai) {
        C::ecrireBrut($this, $this->op['jeton'], 'POST', $this->url, ['two_factor_code' => '000000']);
    }

    C::ecrireBrut($this, $autre['jeton'], 'POST', $this->url, avecPreuve($autre['jeton']))->assertNotFound();
});

it('garde le verrou par e-mail pour la connexion console après des preuves de session fausses', function (): void {
    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE) as $essai) {
        C::ecrireBrut($this, $this->op['jeton'], 'POST', $this->url, ['two_factor_code' => '000000']);
    }

    C::reinitialiser($this);
    $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => preuveConsole($this->op['jeton'])['two_factor_code']])->assertCreated();
});

function mauvaisesPreuvesWeb(mixed $test, mixed $user, int $nombre): void
{
    foreach (range(1, $nombre) as $essai) {
        if ($essai % 4 === 0) {
            $test->travel(61)->seconds();
        }

        auth()->forgetGuards();
        $test->actingAs($user, 'web')->postJson('/auth/reauthenticate/two-factor', ['code' => '000000'])->assertUnprocessable();
    }
}

it('laisse prouver la 2FA web après des échecs de mot de passe anonymes sur le même e-mail', function (): void {
    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE) as $essai) {
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.'.$essai])
            ->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'faux-mot-de-passe', 'code' => '000000'])
            ->assertUnprocessable();
    }

    C::reinitialiser($this);
    $this->actingAs($this->op['user'], 'web')
        ->postJson('/auth/reauthenticate/two-factor', ['code' => preuveConsole($this->op['jeton'])['two_factor_code']])
        ->assertNoContent();
});

it('bloque la preuve 2FA web après des codes faux répétés, même avec un code valide ensuite', function (): void {
    mauvaisesPreuvesWeb($this, $this->op['user'], AccountLockout::ECHECS_MAX_PAR_HEURE);

    $this->travel(61)->seconds();
    auth()->forgetGuards();
    $this->actingAs($this->op['user'], 'web')
        ->postJson('/auth/reauthenticate/two-factor', ['code' => preuveConsole($this->op['jeton'])['two_factor_code']])
        ->assertTooManyRequests();
});

it('compte ensemble les essais de la preuve web et de la preuve opérateur', function (): void {
    $moitie = intdiv(AccountLockout::ECHECS_MAX_PAR_HEURE, 2);
    mauvaisesPreuvesWeb($this, $this->op['user'], $moitie);

    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE - $moitie) as $essai) {
        C::ecrireBrut($this, $this->op['jeton'], 'POST', $this->url, ['two_factor_code' => '000000'])->assertUnprocessable();
    }

    C::ecrireBrut($this, $this->op['jeton'], 'POST', $this->url, avecPreuve($this->op['jeton']))->assertTooManyRequests();

    $this->travel(61)->seconds();
    auth()->forgetGuards();
    $this->actingAs($this->op['user'], 'web')
        ->postJson('/auth/reauthenticate/two-factor', ['code' => preuveConsole($this->op['jeton'])['two_factor_code']])
        ->assertTooManyRequests();
});
