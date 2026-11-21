<?php

declare(strict_types=1);

use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Models\RecoveryTransmissionDownload;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Recovery\RecoveryContext as X;

beforeEach(function (): void {
    X::preparer($this);
});

function recoveryLien(string $jeton): string
{
    return '/api/v1/recovery/downloads/'.$jeton;
}

function recoveryAnonyme(object $test): void
{
    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
}

/**
 * @return array<string, mixed>
 */
function recoveryProbleme(TestResponse $reponse): array
{
    $corps = $reponse->json();
    unset($corps['request_id']);

    return $corps;
}

it('télécharge par jeton sans compte ni cookie : compté, journalisé avec IP et horodatage, réponse privée', function (): void {
    $s = X::transmis($this);
    $sha = $this->getJson(X::url($s['org'], "/bundles/{$s['bundle']}"))->json('data.sha256');
    recoveryAnonyme($this);

    $reponse = $this->get(recoveryLien($s['token']), ['Origin' => 'http://localhost', 'Referer' => 'http://localhost/'])->assertOk();

    expect(hash('sha256', $reponse->streamedContent()))->toBe($sha)
        ->and($reponse->headers->get('Cache-Control'))->toContain('private')->toContain('no-store')
        ->and($reponse->headers->get('Content-Disposition'))->toContain('attachment')
        ->and($reponse->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($reponse->headers->get('Referrer-Policy'))->toBe('no-referrer')
        ->and($reponse->headers->getCookies())->toBe([])
        ->and($reponse->headers->has('Set-Cookie'))->toBeFalse();

    L::dans($s['org'], function () use ($s): void {
        $transmission = RecoveryTransmission::query()->findOrFail($s['transmission']);
        $lignes = RecoveryTransmissionDownload::query()->where('transmission_id', $s['transmission'])->get();

        expect($transmission->download_count)->toBe(1)
            ->and($transmission->first_downloaded_at?->toDateString())->toBe('2026-11-16')
            ->and($lignes)->toHaveCount(1)
            ->and($lignes[0]->ip)->toBe('127.0.0.1')
            ->and($lignes[0]->downloaded_at->toDateString())->toBe('2026-11-16');
    });

    $this->travel(2)->hours();
    $this->get(recoveryLien($s['token']))->assertOk();

    L::dans($s['org'], function () use ($s): void {
        $transmission = RecoveryTransmission::query()->findOrFail($s['transmission']);

        expect($transmission->download_count)->toBe(2)
            ->and($transmission->first_downloaded_at?->format('H'))->toBe('00')
            ->and(RecoveryTransmissionDownload::query()->count())->toBe(2);
    });

    $audit = AuditLog::query()->where('action', 'recovery.transmission.downloaded')->get();
    expect($audit)->toHaveCount(2)->and($audit[0]->actor_user_id)->toBeNull()->and($audit[0]->organization_id)->toBe($s['org']->id)->and($audit[0]->ip)->toBe('127.0.0.1');
});

it('répond le même 404 pour un jeton inconnu, malformé, expiré ou révoqué, sans rien compter', function (): void {
    $s = X::transmis($this);
    $revoque = X::transmis($this);
    $this->postJson(X::url($revoque['org'], "/transmissions/{$revoque['transmission']}/revoke"))->assertOk();
    recoveryAnonyme($this);
    $expire = X::transmis($this);
    $this->travel(8)->days();
    recoveryAnonyme($this);

    $reponses = [
        'inconnu' => $this->getJson(recoveryLien(Str::random(48))),
        'malformé' => $this->getJson(recoveryLien('abc')),
        'révoqué' => $this->getJson(recoveryLien($revoque['token'])),
        'expiré' => $this->getJson(recoveryLien($expire['token'])),
        'expiré (autre lien)' => $this->getJson(recoveryLien($s['token'])),
    ];

    foreach ($reponses as $cas => $reponse) {
        $reponse->assertNotFound()->assertJsonPath('code', 'recovery_link_not_found');
        expect(recoveryProbleme($reponse))->toBe(recoveryProbleme($reponses['inconnu']), $cas)
            ->and($reponse->headers->get('Content-Type'))->toBe($reponses['inconnu']->headers->get('Content-Type'), $cas)
            ->and($reponse->headers->getCookies())->toBe([]);
    }

    expect(RecoveryTransmissionDownload::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(RecoveryTransmission::query()->withoutGlobalScopes()->sum('download_count'))->toBe(0)
        ->and(AuditLog::query()->where('action', 'recovery.transmission.downloaded')->count())->toBe(0);
});

it('un lien expire à la seconde près : valable avant expires_at, mort à expires_at', function (): void {
    $s = X::transmis($this);
    $expiration = CarbonImmutable::parse(L::dans($s['org'], fn () => RecoveryTransmission::query()->findOrFail($s['transmission'])->expires_at->toIso8601String()));
    recoveryAnonyme($this);

    $this->travelTo($expiration->subSecond());
    $this->get(recoveryLien($s['token']))->assertOk();
    $this->travelTo($expiration);
    $this->getJson(recoveryLien($s['token']))->assertNotFound()->assertJsonPath('code', 'recovery_link_not_found');
});

it('un lien révoqué ne se télécharge plus, le nouveau lien d\'un renvoi fonctionne', function (): void {
    $s = X::transmis($this);
    $reponse = $this->postJson(X::url($s['org'], "/transmissions/{$s['transmission']}/resend"))->assertCreated();
    $nouveau = X::jeton();
    recoveryAnonyme($this);

    $this->getJson(recoveryLien($s['token']))->assertNotFound();
    $this->get(recoveryLien($nouveau))->assertOk();
    expect(L::dans($s['org'], fn () => RecoveryTransmission::query()->findOrFail($reponse->json('data.id'))->download_count))->toBe(1);
});

it('limite le débit : au-delà de 5 essais par minute, 429 même pour un jeton valable', function (): void {
    $s = X::transmis($this);
    recoveryAnonyme($this);

    foreach (range(1, 5) as $i) {
        $this->getJson(recoveryLien(Str::random(48)))->assertNotFound();
    }

    $this->getJson(recoveryLien($s['token']))->assertStatus(429);
    $this->travel(2)->minutes();
    $this->get(recoveryLien($s['token']))->assertOk();
});

it('le lien d\'une organisation reste lisible quel que soit le compte connecté, sans lui donner accès au reste', function (): void {
    $s = X::transmis($this);
    $autre = X::impayes($this, nom: 'Autre Agence');
    X::basculer($this, $autre['org']);

    $this->get(recoveryLien($s['token']))->assertOk();
    $this->getJson(X::url($s['org'], "/bundles/{$s['bundle']}"))->assertNotFound()->assertJsonPath('code', 'organization_not_found');
});
