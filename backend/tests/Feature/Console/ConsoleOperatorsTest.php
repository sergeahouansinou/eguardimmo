<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use Tests\Feature\Console\ConsoleContext as C;

it('liste l\'équipe d\'opérateurs à l\'administrateur seul, avec rôles, 2FA et état', function (): void {
    $admin = C::operateur(['admin'], 'Alice Admin', email: 'alice@exemple.fr');
    $support = C::operateur(['support', 'compliance'], 'Sam Support', email: 'sam@exemple.fr');
    $sans2fa = C::operateur(['billing'], 'Bob Billing', false, 'bob@exemple.fr');

    $liste = C::lire($this, $admin['jeton'], '/api/v1/console/operators')->assertOk();

    $lignes = collect($liste->json('data'))->keyBy('email');
    expect($lignes->keys()->all())->toEqualCanonicalizing(['alice@exemple.fr', 'sam@exemple.fr', 'bob@exemple.fr'])
        ->and($lignes['sam@exemple.fr']['roles'])->toBe(['compliance', 'support'])
        ->and($lignes['bob@exemple.fr']['two_factor_confirmed'])->toBeFalse()
        ->and($lignes['alice@exemple.fr']['state'])->toBe('active')
        ->and(array_keys($lignes['sam@exemple.fr']))->toEqualCanonicalizing(['id', 'name', 'email', 'roles', 'two_factor_confirmed', 'last_login_at', 'state', 'granted_at']);

    C::lire($this, $support['jeton'], '/api/v1/console/operators')->assertForbidden()->assertJsonPath('code', 'operator_role_required');
    C::lire($this, $sans2fa['jeton'], '/api/v1/console/operators')->assertForbidden();
});

it('sert les rôles de l\'opérateur sur /console/me et ne met rien en cache', function (): void {
    $op = C::operateur(['support', 'billing'], 'Sam');

    $reponse = C::lire($this, $op['jeton'], '/api/v1/console/me')->assertOk();

    expect($reponse->json('data.roles'))->toBe(['billing', 'support'])
        ->and((string) $reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');
});

it('refuse une écriture sans preuve, avec une preuve fausse, rejouée, puis l\'accepte avec un code frais', function (): void {
    $op = C::operateur(['compliance']);
    $url = '/api/v1/console/support/access/'.C::UUID_INCONNU.'/review';
    $code = preuveConsole($op['jeton'])['two_factor_code'];

    C::ecrireBrut($this, $op['jeton'], 'POST', $url, [])->assertUnprocessable()->assertJsonPath('code', 'operator_proof_required');
    C::ecrireBrut($this, $op['jeton'], 'POST', $url, ['two_factor_code' => '000000'])->assertUnprocessable()->assertJsonPath('code', 'operator_proof_invalid');

    C::ecrireBrut($this, $op['jeton'], 'POST', $url, ['two_factor_code' => $code])->assertNotFound();
    C::ecrireBrut($this, $op['jeton'], 'POST', $url, ['two_factor_code' => $code])->assertUnprocessable()->assertJsonPath('code', 'operator_proof_invalid');
});

it('ignore un code de preuve passé dans l\'URL : la preuve est absente et le code n\'est pas consommé', function (): void {
    $op = C::operateur(['compliance']);
    $url = '/api/v1/console/support/access/'.C::UUID_INCONNU.'/review';
    $code = preuveConsole($op['jeton'])['two_factor_code'];

    C::ecrireBrut($this, $op['jeton'], 'POST', "{$url}?two_factor_code={$code}", [])->assertUnprocessable()->assertJsonPath('code', 'operator_proof_required');
    C::ecrireBrut($this, $op['jeton'], 'POST', "{$url}?recovery_code=code-secours-1", [])->assertUnprocessable()->assertJsonPath('code', 'operator_proof_required');
    C::ecrireBrut($this, $op['jeton'], 'POST', $url, ['two_factor_code' => $code])->assertNotFound();
});

it('accepte un code de secours une seule fois comme preuve', function (): void {
    $op = C::operateur(['compliance']);
    $url = '/api/v1/console/support/access/'.C::UUID_INCONNU.'/review';

    C::ecrireBrut($this, $op['jeton'], 'POST', $url, ['recovery_code' => 'code-secours-1'])->assertNotFound();
    C::ecrireBrut($this, $op['jeton'], 'POST', $url, ['recovery_code' => 'code-secours-1'])->assertUnprocessable()->assertJsonPath('code', 'operator_proof_invalid');
    C::ecrireBrut($this, $op['jeton'], 'POST', $url, ['recovery_code' => 'code-secours-2'])->assertNotFound();
});

it('ne laisse le code de preuve ni dans les données validées, ni dans le journal', function (): void {
    $op = C::operateur(['compliance']);
    $code = preuveConsole($op['jeton'])['two_factor_code'];

    C::ecrireBrut($this, $op['jeton'], 'POST', '/api/v1/console/support/access/'.C::UUID_INCONNU.'/review', ['two_factor_code' => $code])->assertNotFound();

    expect(AuditLog::query()->get()->contains(fn (AuditLog $l): bool => str_contains((string) json_encode($l->metadata), $code)))->toBeFalse();
});

it('verrouille le compte après des preuves fausses répétées', function (): void {
    $op = C::operateur(['compliance']);
    $url = '/api/v1/console/support/access/'.C::UUID_INCONNU.'/review';

    for ($i = 0; $i < 12; $i++) {
        C::ecrireBrut($this, $op['jeton'], 'POST', $url, ['two_factor_code' => '000000']);
    }

    $reponse = C::ecrire($this, $op['jeton'], 'POST', $url);
    expect($reponse->status())->toBe(429);
});

it('retire le rôle opérateur : le jeton console tombe avec l\'audit dans la même transaction', function (): void {
    $op = C::operateur(['admin']);
    C::operateur(['admin'], 'Second administrateur');
    $user = User::query()->findOrFail($op['user']->id);

    $this->artisan('identity:revoke-operator', ['email' => $user->email])->expectsConfirmation("Retirer le rôle opérateur à {$user->email} ?", 'yes')->assertSuccessful();

    expect($user->tokens()->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'identity.operator.revoked')->where('subject_id', $user->id)->count())->toBe(1);
    C::lire($this, $op['jeton'], '/api/v1/console/me')->assertUnauthorized();
});

it('refuse un rôle retiré au prochain appel, sans attendre l\'expiration du jeton', function (): void {
    $op = C::operateur(['admin', 'support']);
    C::lire($this, $op['jeton'], '/api/v1/console/operators')->assertOk();

    $op['user']->operator->roles()->where('role', 'admin')->delete();

    C::lire($this, $op['jeton'], '/api/v1/console/operators')->assertForbidden()->assertJsonPath('code', 'operator_role_required');
});
