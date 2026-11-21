<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Owner\OwnerReportingContext as X;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Reporting\ReportingContext as RP;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = RP::agence($this);
    $this->awa = X::rattacher($this->org, $this->mandant);
    $this->reverser = function (): void {
        F::encaisserEtCloturer($this, $this->org, $this->bail);
        X::agence($this, $this->org);
        $lot = F::lotValide($this);
        $this->actingAs(F::comptable($this->org));
        F::executer($this, $lot)->assertOk();
        RP::cloreDecembre($this);
    };
    $this->releve = fn (?User $compte, string $de, string $a, string $suite = '') => R::lire($this, $compte, "/statement?from={$de}&to={$a}{$suite}");
});

it('sert le relevé du compte du mandant, de la même forme que celui de l\'agence, sans identifiant d\'écriture', function (): void {
    ($this->reverser)();

    $novembre = ($this->releve)($this->awa, '2026-11-01', '2026-11-30')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    $decembre = ($this->releve)($this->awa, '2026-12-01', '2026-12-31')->assertOk()->json('data');
    $d = $novembre->json('data');

    expect(array_keys($d))->toBe(['mandant', 'from', 'to', 'opening_balance', 'closing_balance', 'lines'])
        ->and($d['mandant'])->toBe(['party_id' => $this->mandant->id, 'name' => $this->mandant->display_name])
        ->and($d['from'])->toBe('2026-11-01')->and($d['to'])->toBe('2026-11-30')
        ->and($d['opening_balance'])->toBe(['amount' => 0, 'currency' => 'EUR'])
        ->and($d['closing_balance'])->toBe(['amount' => 70000, 'currency' => 'EUR'])
        ->and($d['lines'])->toHaveCount(1)
        ->and(array_keys($d['lines'][0]))->toBe(['date', 'reference', 'label', 'source', 'unit_id', 'lease_id', 'is_reversal', 'debit', 'credit', 'balance'])
        ->and($d['lines'][0]['credit'])->toBe(['amount' => 70000, 'currency' => 'EUR'])
        ->and($d['lines'][0]['balance']['amount'])->toBe(70000)
        ->and($d['lines'][0]['is_reversal'])->toBeFalse()
        ->and($decembre['opening_balance']['amount'])->toBe(70000)
        ->and($decembre['closing_balance']['amount'])->toBe(F::solde($this->org, AccountRole::OwnerPayable))
        ->and(collect($decembre['lines'])->sum('debit.amount'))->toBe(70000)
        ->and(R::texte($novembre))->not->toContain('locataire.secret')->and(R::texte($novembre))->not->toContain('entry_id');
});

it('journalise chaque consultation dans l\'organisation de l\'agence, sans donnée personnelle', function (): void {
    ($this->reverser)();
    ($this->releve)($this->awa, '2026-11-01', '2026-11-30')->assertOk();
    ($this->releve)($this->awa, '2026-11-01', '2026-11-30', '&format=csv')->assertOk();

    $journal = RP::dans($this->org, fn () => AuditLog::query()->where('action', 'reporting.owner_statement.viewed')->orderBy('occurred_at')->get());

    expect($journal)->toHaveCount(2)
        ->and($journal[0]->actor_user_id)->toBe($this->awa->id)
        ->and($journal[0]->organization_id)->toBe($this->org->id)
        ->and($journal[0]->metadata)->toBe(['mandant_party_id' => $this->mandant->id, 'from' => '2026-11-01', 'to' => '2026-11-30', 'format' => 'json'])
        ->and($journal[1]->metadata['format'])->toBe('csv');
});

it('exporte le relevé en CSV privé, formules neutralisées', function (): void {
    ($this->reverser)();
    $csv = ($this->releve)($this->awa, '2026-11-01', '2026-11-30', '&format=csv')->assertOk();

    expect($csv->headers->get('Content-Type'))->toContain('text/csv')
        ->and($csv->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')
        ->and($csv->headers->get('Content-Disposition'))->toContain('attachment')
        ->and($csv->getContent())->toContain('"date";"reference";"libelle";"debit_minor";"credit_minor";"solde_minor";"devise"')->toContain(';70000;70000;"EUR"')
        ->and($csv->getContent())->not->toContain('locataire.secret');
});

it('borne la période : obligatoire, ordonnée, 366 jours au plus', function (): void {
    foreach (['', '?from=2026-11-01', '?to=2026-11-30', '?from=2026-12-01&to=2026-11-01', '?from=11/2026&to=2026-11-30', '?from=2026-11-01&to=2026-11-30&format=pdf'] as $requete) {
        R::lire($this, $this->awa, '/statement'.$requete)->assertUnprocessable();
    }

    ($this->releve)($this->awa, '2026-01-01', '2027-01-01')->assertOk();
    ($this->releve)($this->awa, '2026-01-01', '2027-01-02')->assertUnprocessable()->assertJsonValidationErrors('to');
    ($this->releve)($this->awa, '2024-01-01', '2024-12-31')->assertOk();
    ($this->releve)($this->awa, '2024-01-01', '2025-01-01')->assertUnprocessable();
    ($this->releve)($this->awa, '2000-01-01', '2026-12-31')->assertUnprocessable();
});

it('exige une session, un profil propriétaire et refuse le co-indivisaire', function (): void {
    O::comme($this, null)->getJson('/api/v1/owner/statement?from=2026-11-01&to=2026-11-30')->assertUnauthorized();

    foreach ([User::factory()->create(), T::locataire($this->org)['user'], L::titulaire($this->org)] as $compte) {
        ($this->releve)($compte, '2026-11-01', '2026-11-30')->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    }

    $indivisaire = X::rattacher($this->org, $this->mandant, 'co@exemple.fr', OwnerAccessRole::CoOwner);
    ($this->releve)($indivisaire, '2026-11-01', '2026-11-30')->assertForbidden()->assertJsonPath('code', 'owner_role_forbidden');
});

it('ne sert jamais le relevé d\'un autre mandant, qu\'il soit de la même agence ou d\'une autre, même si le client en désigne un', function (): void {
    ($this->reverser)();
    $bob = R::proprietaire($this->org, 'bob@exemple.fr')['user'];
    $sansMandat = X::rattacher($this->org, T::partie($this->org, ['display_name' => 'Sans Mandat']), 'sans@exemple.fr');
    $autre = T::organisation('Immo Loire');
    $loire = R::proprietaire($autre, 'loire@exemple.fr');

    $lui = ($this->releve)($bob, '2026-11-01', '2026-12-31', '&mandant='.$this->mandant->id.'&mandant_party_id='.$this->mandant->id.'&organization_id='.$this->org->id)->assertOk();
    expect($lui->json('data.mandant.party_id'))->not->toBe($this->mandant->id)
        ->and($lui->json('data.lines'))->toBe([])
        ->and($lui->json('data.closing_balance.amount'))->toBe(0)
        ->and(R::texte($lui))->not->toContain('70000');

    $siens = R::texte(($this->releve)($this->awa, '2026-11-01', '2026-12-31')->assertOk());
    expect($siens)->not->toContain($loire['party']->id)->and($siens)->not->toContain('Immo Loire');
    ($this->releve)($this->awa, '2026-11-01', '2026-11-30', '&agency='.$autre->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
    ($this->releve)($loire['user'], '2026-11-01', '2026-11-30', '&agency='.$this->org->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
    ($this->releve)($this->awa, '2026-11-01', '2026-11-30', '&agency=pas-un-uuid')->assertNotFound();
    ($this->releve)($sansMandat, '2026-11-01', '2026-11-30')->assertNotFound()->assertJsonPath('code', 'owner_mandant_not_found');
});

it('exige de préciser l\'agence quand le compte a plusieurs mandants, et ne mêle jamais leurs relevés', function (): void {
    ($this->reverser)();
    $autre = T::organisation('Immo Loire');
    $loire = R::proprietaire($autre, 'loire@exemple.fr');
    L::dans($autre, fn () => $loire['access']->forceFill(['user_id' => $this->awa->id])->save());

    ($this->releve)($this->awa, '2026-11-01', '2026-11-30')->assertUnprocessable()->assertJsonPath('code', 'owner_agency_required');
    $chez = ($this->releve)($this->awa, '2026-11-01', '2026-11-30', '&agency='.$this->org->id)->assertOk();
    $ailleurs = ($this->releve)($this->awa, '2026-11-01', '2026-11-30', '&agency='.$autre->id)->assertOk();

    expect($chez->json('data.mandant.party_id'))->toBe($this->mandant->id)
        ->and($chez->json('data.closing_balance.amount'))->toBe(70000)
        ->and($ailleurs->json('data.mandant.party_id'))->toBe($loire['party']->id)
        ->and($ailleurs->json('data.closing_balance.amount'))->toBe(0)
        ->and($ailleurs->json('data.lines'))->toBe([]);
});
