<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication as Reauth;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Console\ConsoleContext as C;
use Tests\Feature\Privacy\PrivacyContext as P;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Mail::fake();
    Storage::fake('local');
    config(['notifications.push.driver' => 'fake', 'privacy.team_address' => 'conformite@example.test']);
    $this->conformite = C::operateur(['compliance'], 'Clara Conformité');
    $this->demandeur = User::factory()->create(['name' => 'Léa Martin', 'email' => 'lea.martin@example.test']);
    $this->id = P::deposer($this, $this->demandeur, 'access')->assertCreated()->json('data.id');
    P::agir($this, $this->conformite, $this->id, 'complete')->assertOk();
    C::reinitialiser($this);
    $this->url = P::URL."/{$this->id}/export";
    $this->telechargements = fn (): int => AuditLog::query()->where('action', 'privacy.export.downloaded')->count();
});

it('livre l\'export avec une preuve de mot de passe ou de double authentification récente', function (string $cle): void {
    P::avecPreuve(T::comme($this, $this->demandeur), $cle)->getJson($this->url)->assertOk()->assertHeader('Content-Type', 'application/json');

    expect(($this->telechargements)())->toBe(1);
})->with([
    'mot de passe' => [Reauth::CLE_MOT_DE_PASSE],
    'double authentification' => [Reauth::CLE_2FA],
]);

it('refuse l\'export sans preuve récente et n\'en journalise aucun téléchargement', function (): void {
    P::navigateur(T::comme($this, $this->demandeur))->getJson($this->url)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    expect(($this->telechargements)())->toBe(0);
});

it('refuse l\'export à une preuve vieille de plus de dix minutes', function (): void {
    P::navigateur(T::comme($this, $this->demandeur))->withSession([Reauth::CLE_MOT_DE_PASSE => now()->subMinutes(10)->subSecond()->getTimestamp()])
        ->getJson($this->url)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    expect(($this->telechargements)())->toBe(0);
});

it('refuse l\'export à un jeton mobile, preuve de session ou non', function (): void {
    $jeton = $this->demandeur->createToken('mobile')->plainTextToken;

    T::comme($this, null);
    P::navigateur($this)->withToken($jeton)->withSession([Reauth::CLE_MOT_DE_PASSE => now()->getTimestamp()])->getJson($this->url)
        ->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    expect(($this->telechargements)())->toBe(0);
});
