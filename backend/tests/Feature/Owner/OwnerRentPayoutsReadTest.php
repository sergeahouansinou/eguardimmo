<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\DB;
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
    $this->reverser = function (): array {
        F::encaisserEtCloturer($this, $this->org, $this->bail);
        X::agence($this, $this->org);
        $lot = F::lotValide($this);
        $this->actingAs(F::comptable($this->org));
        F::executer($this, $lot)->assertOk();
        RP::cloreDecembre($this);

        return $lot;
    };
    $this->etranger = function (string $email = 'bob@exemple.fr'): array {
        $autre = T::organisation('Immo Loire');
        $p = R::proprietaire($autre, $email);
        R::bail($autre, $p['unit'], [], 'Louis Loire');

        return [...$p, 'org' => $autre];
    };
});

it('sert les loyers d\'un mois par lot avec les chiffres du grand livre, sans donnée du locataire', function (): void {
    ($this->reverser)();

    $novembre = R::lire($this, $this->awa, '/rent/2026-11')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    $decembre = R::lire($this, $this->awa, '/rent/2026-12')->assertOk();
    $bloc = $novembre->json('data.mandants.0');

    expect($novembre->json('data.month'))->toBe('2026-11')
        ->and($novembre->json('data.mandants'))->toHaveCount(1)
        ->and($bloc['agency'])->toBe(['id' => $this->org->id, 'name' => $this->org->name])
        ->and($bloc['currency'])->toBe('EUR')
        ->and($bloc['units'])->toHaveCount(1)
        ->and($bloc['units'][0]['amounts']['called'])->toBe(['amount' => 70000, 'currency' => 'EUR'])
        ->and($bloc['units'][0]['amounts']['collected'])->toBe(['amount' => 70000, 'currency' => 'EUR'])
        ->and($bloc['units'][0]['amounts']['net']['amount'])->toBe(70000)
        ->and($bloc['units'][0]['arrears'])->toBe(['amount' => 0, 'currency' => 'EUR'])
        ->and($bloc['totals']['collected']['amount'])->toBe(70000)
        ->and($decembre->json('data.mandants.0.totals.fees.amount'))->toBe(5880)
        ->and($decembre->json('data.mandants.0.totals.collected.amount'))->toBe(0)
        ->and($decembre->json('data.mandants.0.totals.net.amount'))->toBe(-5880)
        ->and(R::texte($novembre))->not->toContain('tenant')->and(R::texte($novembre))->not->toContain('lease');
});

it('un loyer d\'un mois sans écriture vaut zéro et un mois mal formé n\'existe pas', function (): void {
    R::lire($this, $this->awa, '/rent/2024-03')->assertOk()->assertJsonPath('data.mandants.0.totals.collected.amount', 0)->assertJsonPath('data.mandants.0.units', []);

    foreach (['2026-13', '2026-00', '2026-1', 'novembre', '2026-11-01', '1899-12'] as $mois) {
        R::lire($this, $this->awa, '/rent/'.$mois)->assertNotFound();
    }
});

it('ne mêle jamais les loyers d\'un autre propriétaire, de la même agence ou d\'une autre', function (): void {
    ($this->reverser)();
    $bob = X::rattacher($this->org, T::partie($this->org, ['display_name' => 'Bob Autre']), 'bob@exemple.fr');
    $ailleurs = ($this->etranger)('loire@exemple.fr');

    $lui = R::lire($this, $bob, '/rent/2026-11')->assertOk();
    expect($lui->json('data.mandants'))->toBeEmpty()
        ->and(R::texte($lui))->not->toContain('70000');

    $siens = R::texte(R::lire($this, $this->awa, '/rent/2026-11')->assertOk());
    expect($siens)->not->toContain($ailleurs['unit']->reference)->and($siens)->not->toContain('Immo Loire');
    R::lire($this, $ailleurs['user'], '/rent/2026-11')->assertOk()->assertJsonPath('data.mandants.0.totals.collected.amount', 0);
});

it('restreint les loyers par ?agency= et refuse une agence hors clé', function (): void {
    ($this->reverser)();
    $autre = T::organisation('Immo Loire');
    $lui = R::proprietaire($autre, 'loire@exemple.fr');
    L::dans($autre, fn () => $lui['access']->forceFill(['user_id' => $this->awa->id])->save());

    expect(R::lire($this, $this->awa, '/rent/2026-11')->assertOk()->json('data.mandants'))->toHaveCount(2);
    $filtre = R::lire($this, $this->awa, '/rent/2026-11?agency='.$this->org->id)->assertOk();
    expect($filtre->json('data.mandants'))->toHaveCount(1)->and($filtre->json('data.mandants.0.totals.collected.amount'))->toBe(70000);

    R::lire($this, $this->awa, '/rent/2026-11?agency='.T::organisation('Tiers')->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
});

it('exige une session et un profil propriétaire pour les loyers', function (): void {
    O::comme($this, null)->getJson('/api/v1/owner/rent/2026-11')->assertUnauthorized();
    R::lire($this, User::factory()->create(), '/rent/2026-11')->assertForbidden();
    R::lire($this, L::titulaire($this->org), '/rent/2026-11')->assertForbidden();
});

it('lit les loyers avec un nombre de requêtes proportionnel aux agences, pas aux lignes', function (): void {
    ($this->reverser)();
    $mesure = fn (): int => R::requetes($this, $this->awa, '/rent/2026-11');
    $un = $mesure();

    foreach (['Immo Loire', 'Immo Rhone', 'Immo Seine'] as $i => $nom) {
        $autre = T::organisation($nom);
        $lui = R::proprietaire($autre, "x{$i}@exemple.fr");
        R::bail($autre, $lui['unit']);
        L::dans($autre, fn () => $lui['access']->forceFill(['user_id' => $this->awa->id])->save());
        $comptes[$i] = $mesure();
    }

    expect($comptes[1] - $comptes[0])->toBe($comptes[2] - $comptes[1])->and($comptes[0] - $un)->toBeGreaterThan(0);
});

it('liste le reversement exécuté : numéro, date, montant, quatre derniers caractères, rien de bancaire', function (): void {
    ($this->reverser)();

    $reponse = R::lire($this, $this->awa, '/payouts')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    $texte = R::texte($reponse);

    expect($reponse->json('data'))->toHaveCount(1)
        ->and($reponse->json('data.0'))->toMatchArray(['number' => 'RV-2026-0001', 'status' => 'paid', 'date' => '2026-12-10', 'bank_last4' => '4321'])
        ->and($reponse->json('data.0.amount'))->toBe(['amount' => 64120, 'currency' => 'EUR'])
        ->and($reponse->json('data.0.agency'))->toBe(['id' => $this->org->id, 'name' => $this->org->name])
        ->and($texte)->not->toContain('VIR-1')->and($texte)->not->toContain('bank_reference')->and($texte)->not->toContain('failure')
        ->and($texte)->not->toContain('fees_settled')->and($texte)->not->toContain('batch_id')->and($texte)->not->toContain('mandant_party_id');
});

it('montre un reversement validé non exécuté comme en cours, et jamais un brouillon', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    X::agence($this, $this->org);
    $brouillon = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated()->json('data.id');

    R::lire($this, $this->awa, '/payouts')->assertOk()->assertJsonCount(0, 'data');

    X::agence($this, $this->org);
    F::valider($this, $brouillon)->assertOk();
    $liste = R::lire($this, $this->awa, '/payouts')->assertOk();

    expect($liste->json('data'))->toHaveCount(1)->and($liste->json('data.0.status'))->toBe('pending')->and($liste->json('data.0.number'))->not->toBeNull();
});

it('ne communique que les quatre motifs neutres d\'un lot ouvert et le jour de reversement indicatif', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    X::agence($this, $this->org);
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated();
    $item = $lot->json('data.items.0.id');
    $poser = fn (string $motif) => L::dans($this->org, fn () => DB::table('payout_items')->where('id', $item)->update(['status' => 'excluded', 'exclusion_reason' => $motif]));

    $poser('below_minimum');
    $prevu = R::lire($this, $this->awa, '/payouts')->assertOk()->json('upcoming.0');
    expect($prevu['notice']['code'])->toBe('below_minimum')->and($prevu['notice']['message'])->not->toBe('')
        ->and($prevu['date'])->toMatch('/^\d{4}-\d{2}-05$/')->and($prevu['mandant'])->toBe(['name' => $this->mandant->display_name]);

    foreach (['negative_balance', 'active_hold', 'trust_funds_gap', 'manual', 'stale'] as $interne) {
        $poser($interne);
        $reponse = R::lire($this, $this->awa, '/payouts')->assertOk();
        expect($reponse->json('upcoming.0.notice'))->toBeNull()->and(R::texte($reponse))->not->toContain($interne);
    }
});

it('ne sert aucun reversement au co-indivisaire ni à un autre propriétaire', function (): void {
    ($this->reverser)();
    $co = X::rattacher($this->org, $this->mandant, 'co@exemple.fr', OwnerAccessRole::CoOwner);
    $bob = X::rattacher($this->org, T::partie($this->org, ['display_name' => 'Bob Autre']), 'bob@exemple.fr');
    $ailleurs = ($this->etranger)('loire@exemple.fr');

    foreach ([$co, $bob, $ailleurs['user']] as $compte) {
        $reponse = R::lire($this, $compte, '/payouts')->assertOk();
        expect($reponse->json('data'))->toBeEmpty()->and(R::texte($reponse))->not->toContain('RV-2026');
    }
    expect(R::lire($this, $co, '/payouts')->json('upcoming'))->toBeEmpty();
});

it('exige une session et un profil propriétaire pour les reversements, et valide le curseur', function (): void {
    O::comme($this, null)->getJson('/api/v1/owner/payouts')->assertUnauthorized();
    R::lire($this, User::factory()->create(), '/payouts')->assertForbidden();
    R::lire($this, $this->awa, '/payouts?cursor=n-importe-quoi')->assertUnprocessable();
    R::lire($this, $this->awa, '/payouts?per_page=0')->assertUnprocessable();
    R::lire($this, $this->awa, '/payouts?organization_id='.$this->org->id.'&mandant_party_id='.$this->mandant->id)->assertOk();
});
