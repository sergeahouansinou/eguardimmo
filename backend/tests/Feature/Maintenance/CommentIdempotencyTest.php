<?php

declare(strict_types=1);

use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Models\InterventionEvent;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;

const CLE_COMMENTAIRE = 'cmt-8f2c1d3e-4b5a-4c6d-9e7f-0a1b2c3d4e5f';

function commentaires(): int
{
    return InterventionEvent::query()->withoutGlobalScopes()->where('kind', EventKind::Comment->value)->count();
}

/**
 * @return array<string, string>
 */
function enteteCle(?string $cle = CLE_COMMENTAIRE): array
{
    return $cle === null ? [] : ['Idempotency-Key' => $cle];
}

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    $this->intervention = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::comme($this, $this->scene['owner']);
    $this->url = C::url($this->scene['org'], "/interventions/{$this->intervention}/comments");
});

it('crée le commentaire (201) puis rejoue la même requête (200) sans second événement', function (): void {
    $premiere = $this->postJson($this->url, ['text' => 'Le plombier passe mardi.', 'visible_to_tenant' => true], enteteCle())->assertCreated();
    expect(commentaires())->toBe(1);

    $rejeu = $this->postJson($this->url, ['text' => 'Le plombier passe mardi.', 'visible_to_tenant' => true], enteteCle())->assertOk();

    expect($rejeu->json('data.id'))->toBe($premiere->json('data.id'))
        ->and($rejeu->json('data.text'))->toBe('Le plombier passe mardi.')
        ->and($rejeu->json('data.visible_to_tenant'))->toBeTrue()
        ->and($rejeu->json('data'))->not->toHaveKey('idempotency_key')
        ->and(commentaires())->toBe(1)
        ->and(InterventionEvent::query()->withoutGlobalScopes()->where('idempotency_key', CLE_COMMENTAIRE)->count())->toBe(1);
});

it('sans en-tête, le comportement est inchangé : deux écritures, aucune clé stockée', function (): void {
    $a = $this->postJson($this->url, ['text' => 'Même texte'])->assertCreated()->json('data.id');
    $b = $this->postJson($this->url, ['text' => 'Même texte'])->assertCreated()->json('data.id');

    expect($a)->not->toBe($b)
        ->and(commentaires())->toBe(2)
        ->and(InterventionEvent::query()->withoutGlobalScopes()->whereNotNull('idempotency_key')->count())->toBe(0);
});

it('refuse une clé mal formée (422) sans rien écrire', function (string $cle): void {
    $this->postJson($this->url, ['text' => 'Bonjour'], ['Idempotency-Key' => $cle])->assertUnprocessable()->assertJsonPath('code', 'idempotency_key_required');

    expect(commentaires())->toBe(0);
})->with(['trop courte' => 'abc', 'trop longue' => str_repeat('a', 65), 'caractères interdits' => 'cle avec espaces!']);

it('refuse la réutilisation de la clé avec un autre contenu ou une autre intervention (409)', function (): void {
    $this->postJson($this->url, ['text' => 'Texte initial', 'visible_to_tenant' => false], enteteCle())->assertCreated();

    $this->postJson($this->url, ['text' => 'Texte modifié', 'visible_to_tenant' => false], enteteCle())->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');
    $this->postJson($this->url, ['text' => 'Texte initial', 'visible_to_tenant' => true], enteteCle())->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');
    $this->postJson($this->url, ['text' => 'Texte initial', 'visible_to_owner' => true], enteteCle())->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');

    $autre = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::comme($this, $this->scene['owner']);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$autre}/comments"), ['text' => 'Texte initial', 'visible_to_tenant' => false], enteteCle())
        ->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');

    expect(commentaires())->toBe(1);
});

it('la même clé d\'un autre utilisateur de l\'organisation ne collisionne pas', function (): void {
    $premier = $this->postJson($this->url, ['text' => 'Premier auteur'], enteteCle())->assertCreated()->json('data.id');

    C::comme($this, L::membre($this->scene['org'], MemberRole::Manager));
    $second = $this->postJson($this->url, ['text' => 'Second auteur'], enteteCle())->assertCreated()->json('data.id');

    expect($second)->not->toBe($premier)->and(commentaires())->toBe(2);
});

it('cloisonne la clé par organisation : une autre agence ne voit ni ne rejoue la ressource', function (): void {
    $this->postJson($this->url, ['text' => 'Interne à l\'agence A'], enteteCle())->assertCreated();

    $autre = C::agence();
    $interventionAutre = (string) C::signaler($this, $autre)->assertCreated()->json('data.id');
    C::comme($this, $autre['owner']);

    $this->postJson($this->url, ['text' => 'Interne à l\'agence A'], enteteCle())->assertNotFound();
    $this->postJson(C::url($autre['org'], "/interventions/{$interventionAutre}/comments"), ['text' => 'Agence B'], enteteCle())->assertCreated();

    expect(commentaires())->toBe(2);
});

it('tranche une course : la clé prise entre la lecture et l\'insertion est relue, jamais de 500', function (): void {
    $premier = $this->postJson($this->url, ['text' => 'Gagnant', 'visible_to_tenant' => true], enteteCle())->assertCreated()->json('data.id');
    $masquer = true;

    InterventionEvent::addGlobalScope('invisible-au-snapshot', function (Builder $requete) use (&$masquer): void {
        if ($masquer) {
            $requete->where(fn (Builder $q) => $q->whereNull('idempotency_key')->orWhere('idempotency_key', '!=', CLE_COMMENTAIRE));
        }
    });
    InterventionEvent::creating(function () use (&$masquer): never {
        $masquer = false;

        throw new UniqueConstraintViolationException('sqlite', 'insert into "intervention_events"', [], new PDOException('UNIQUE constraint failed'));
    });

    $rejeu = $this->postJson($this->url, ['text' => 'Gagnant', 'visible_to_tenant' => true], enteteCle())->assertOk();

    expect($rejeu->json('data.id'))->toBe($premier);

    $masquer = true;
    $this->postJson($this->url, ['text' => 'Perdant', 'visible_to_tenant' => true], enteteCle())->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');
});

it('le commentaire du locataire, sans clé, reste inchangé', function (): void {
    C::comme($this, $this->scene['tenant']);

    $this->postJson(C::BASE."/tenant/interventions/{$this->intervention}/comments", ['text' => 'Merci'])->assertCreated();
    $this->postJson(C::BASE."/tenant/interventions/{$this->intervention}/comments", ['text' => 'Merci'])->assertCreated();

    expect(commentaires())->toBe(2);
});
