<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Recovery\RecoveryContext as X;

const CLE_ACTE = 'act-3b9d7e21-6c4f-4a8e-b1d0-5e2f9a7c4d18';

function actes(): int
{
    return RecoveryAct::query()->withoutGlobalScopes()->where('type', 'call')->count();
}

function audits(): int
{
    return AuditLog::query()->where('action', 'recovery.act.added')->count();
}

/**
 * @return array<string, mixed>
 */
function corpsActe(string $note = 'Le locataire promet un virement'): array
{
    return ['type' => 'call', 'performed_on' => '2026-11-16', 'note' => $note, 'reference' => 'APPEL-1'];
}

/**
 * @return array<string, string>
 */
function enteteActe(string $cle = CLE_ACTE): array
{
    return ['Idempotency-Key' => $cle];
}

beforeEach(function (): void {
    X::preparer($this);
    $this->s = X::dossier($this, 1);
    $this->url = X::url($this->s['org'], "/cases/{$this->s['case']}/acts");
});

it('crée l\'acte (201) puis rejoue la même requête (200) sans second acte ni second audit', function (): void {
    $premier = $this->postJson($this->url, corpsActe(), enteteActe())->assertCreated();

    expect(actes())->toBe(1)->and(audits())->toBe(1);

    $rejeu = $this->postJson($this->url, corpsActe(), enteteActe())->assertOk();

    expect($rejeu->json('data.id'))->toBe($premier->json('data.id'))
        ->and($rejeu->json('data.note'))->toBe('Le locataire promet un virement')
        ->and($rejeu->json('data'))->not->toHaveKey('idempotency_key')
        ->and(actes())->toBe(1)
        ->and(audits())->toBe(1)
        ->and(RecoveryAct::query()->withoutGlobalScopes()->where('idempotency_key', CLE_ACTE)->count())->toBe(1);
});

it('sans en-tête, le comportement est inchangé : deux actes, aucune clé stockée', function (): void {
    $a = $this->postJson($this->url, corpsActe())->assertCreated()->json('data.id');
    $b = $this->postJson($this->url, corpsActe())->assertCreated()->json('data.id');

    expect($a)->not->toBe($b)
        ->and(actes())->toBe(2)
        ->and(audits())->toBe(2)
        ->and(RecoveryAct::query()->withoutGlobalScopes()->whereNotNull('idempotency_key')->count())->toBe(0);
});

it('refuse une clé mal formée (422) sans rien écrire', function (string $cle): void {
    $this->postJson($this->url, corpsActe(), enteteActe($cle))->assertUnprocessable()->assertJsonPath('code', 'recovery_idempotency_key_required');

    expect(actes())->toBe(0)->and(audits())->toBe(0);
})->with(['trop courte' => 'abc', 'trop longue' => str_repeat('a', 65), 'caractères interdits' => 'cle avec espaces!']);

it('refuse la réutilisation de la clé avec un autre contenu ou un autre dossier (409)', function (): void {
    $this->postJson($this->url, corpsActe(), enteteActe())->assertCreated();

    $this->postJson($this->url, corpsActe('Autre note'), enteteActe())->assertConflict()->assertJsonPath('code', 'recovery_idempotency_key_reused');
    $this->postJson($this->url, [...corpsActe(), 'type' => 'note'], enteteActe())->assertConflict()->assertJsonPath('code', 'recovery_idempotency_key_reused');
    $this->postJson($this->url, [...corpsActe(), 'reference' => 'APPEL-2'], enteteActe())->assertConflict()->assertJsonPath('code', 'recovery_idempotency_key_reused');

    $voisin = X::impayes($this, $this->s['org']);
    $autre = X::ouvrir($this, $voisin['org'], $voisin['bail'], $voisin['locataire'], [$voisin['ids'][0]])->assertCreated()->json('data.id');
    $this->postJson(X::url($voisin['org'], "/cases/{$autre}/acts"), corpsActe(), enteteActe())->assertConflict()->assertJsonPath('code', 'recovery_idempotency_key_reused');

    expect(actes())->toBe(1)->and(audits())->toBe(1);
});

it('la même clé d\'un autre utilisateur de l\'organisation ne collisionne pas', function (): void {
    $premier = $this->postJson($this->url, corpsActe(), enteteActe())->assertCreated()->json('data.id');

    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
    $this->actingAs(L::membre($this->s['org'], MemberRole::Manager));
    $second = $this->postJson($this->url, corpsActe(), enteteActe())->assertCreated()->json('data.id');

    expect($second)->not->toBe($premier)->and(actes())->toBe(2);
});

it('cloisonne la clé par organisation : une autre agence ne rejoue pas l\'acte et ne peut pas écrire dans ce dossier', function (): void {
    $this->postJson($this->url, corpsActe(), enteteActe())->assertCreated();

    $b = X::impayes($this, nom: 'Agence B');
    $dossierB = X::ouvrir($this, $b['org'], $b['bail'], $b['locataire'], [$b['ids'][0]])->assertCreated()->json('data.id');

    $this->postJson($this->url, corpsActe(), enteteActe())->assertNotFound();
    $this->postJson(X::url($b['org'], "/cases/{$dossierB}/acts"), corpsActe(), enteteActe())->assertCreated();

    expect(actes())->toBe(2)
        ->and(L::dans($this->s['org'], fn () => RecoveryAct::query()->count()))->toBe(1)
        ->and(L::dans($b['org'], fn () => RecoveryAct::query()->count()))->toBe(1);
});

it('tranche une course : la clé prise entre la lecture et l\'insertion est relue, jamais de 500', function (): void {
    $premier = $this->postJson($this->url, corpsActe(), enteteActe())->assertCreated()->json('data.id');
    $masquer = true;

    RecoveryAct::addGlobalScope('invisible-au-snapshot', function (Builder $requete) use (&$masquer): void {
        if ($masquer) {
            $requete->where(fn (Builder $q) => $q->whereNull('idempotency_key')->orWhere('idempotency_key', '!=', CLE_ACTE));
        }
    });
    RecoveryAct::creating(function () use (&$masquer): never {
        $masquer = false;

        throw new UniqueConstraintViolationException('sqlite', 'insert into "recovery_acts"', [], new PDOException('UNIQUE constraint failed'));
    });

    $rejeu = $this->postJson($this->url, corpsActe(), enteteActe())->assertOk();

    expect($rejeu->json('data.id'))->toBe($premier);

    $masquer = true;
    $this->postJson($this->url, corpsActe('Autre note'), enteteActe())->assertConflict()->assertJsonPath('code', 'recovery_idempotency_key_reused');
});
