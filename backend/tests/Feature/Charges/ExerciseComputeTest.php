<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext;

beforeEach(function (): void {
    C::preparer($this);
});

function clePoids(object $test, array $scene, string $genre, array $poids): string
{
    $parts = [];
    foreach ($poids as $lot => $poidsLot) {
        $parts[] = ['unit_id' => $lot, 'weight' => $poidsLot];
    }

    return E::cle($test, $scene, $genre, $parts === [] ? [] : ['shares' => $parts])->assertCreated()->json('data.id');
}

it('tantièmes : part exacte du bail, provisions du grand livre, reste au propriétaire (jeu de référence fait à la main)', function (): void {
    $scene = E::scene($this);
    $b = E::lot($scene['org'], $scene['property']);
    C::comme($this, $scene['owner']);
    $cle = clePoids($this, $scene, 'tantiemes', [$scene['unit']->id => 64, $b->id => 936]);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['key_id' => $cle]);

    $reponse = E::calculer($this, $scene, $exercice)->assertOk()
        ->assertJsonPath('data.status', 'computed')
        ->assertJsonPath('data.statements.0.occupied_days', 304)
        ->assertJsonPath('data.statements.0.share_total.amount', 5120)
        ->assertJsonPath('data.statements.0.provisions_called.amount', 5000)
        ->assertJsonPath('data.statements.0.balance.amount', 120)
        ->assertJsonPath('data.statements.0.suggested_monthly_provision.amount', 0)
        ->assertJsonPath('data.items.0.owner_share.amount', 74880)
        ->assertJsonPath('data.excluded_leases', []);

    $lignes = E::lignes($scene['org'], $reponse->json('data.statements.0.id'));
    expect($lignes)->toHaveCount(1)
        ->and($lignes[0]['split_label'])->toBe('Tantièmes 64/1 000')
        ->and([$lignes[0]['weight'], $lignes[0]['denominator'], $lignes[0]['days'], $lignes[0]['share'], $lignes[0]['item_amount']])->toBe([64, 1000, 304, 5120, 80000]);
});

it('surface : le dénominateur compte tous les lots, vacants compris', function (): void {
    $scene = E::scene($this);
    $b = E::lot($scene['org'], $scene['property'], 7000);
    C::comme($this, $scene['owner']);
    $cle = clePoids($this, $scene, 'surface', []);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene, 100000), 100000, ['key_id' => $cle]);

    $r = E::calculer($this, $scene, $exercice)->assertOk()->assertJsonPath('data.statements.0.share_total.amount', 42622)->assertJsonPath('data.items.0.owner_share.amount', 57378);

    expect(E::lignes($scene['org'], $r->json('data.statements.0.id'))[0]['split_label'])->toBe('Surface 52 m²')->and($b->id)->not->toBeEmpty();
});

it('part égale : un tiers, arrondi à l\'unité mineure inférieure', function (): void {
    $scene = E::scene($this);
    E::lot($scene['org'], $scene['property']);
    E::lot($scene['org'], $scene['property']);
    C::comme($this, $scene['owner']);
    $cle = clePoids($this, $scene, 'equal', []);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene, 100000), 100000, ['key_id' => $cle]);

    $r = E::calculer($this, $scene, $exercice)->assertOk()->assertJsonPath('data.statements.0.share_total.amount', 33333);

    expect(E::lignes($scene['org'], $r->json('data.statements.0.id'))[0]['split_label'])->toBe('Part égale 1/3');
});

it('consommation : quantités saisies sur le poste, une base par lot', function (): void {
    $scene = E::scene($this);
    $b = E::lot($scene['org'], $scene['property']);
    C::comme($this, $scene['owner']);
    $cle = clePoids($this, $scene, 'consumption', []);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, [
        'key_id' => $cle,
        'consumptions' => [['unit_id' => $scene['unit']->id, 'quantity_milli' => 12500], ['unit_id' => $b->id, 'quantity_milli' => 37500]],
    ]);

    $r = E::calculer($this, $scene, $exercice)->assertOk()->assertJsonPath('data.statements.0.share_total.amount', 20000);

    expect(E::lignes($scene['org'], $r->json('data.statements.0.id'))[0]['split_label'])->toBe('Consommation');
});

it('un poste au lot revient au bail qui occupe le lot', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['unit_id' => $scene['unit']->id]);

    $r = E::calculer($this, $scene, $exercice)->assertOk()->assertJsonPath('data.statements.0.share_total.amount', 80000)->assertJsonPath('data.items.0.owner_share.amount', 0);

    expect(E::lignes($scene['org'], $r->json('data.statements.0.id'))[0]['split_label'])->toBe('Poste du lot');
});

it('entrée et sortie en cours de période : prorata au jour, chaque part arrondie vers le bas, le reste au propriétaire', function (): void {
    $this->travelTo('2026-11-16');
    $scene = E::sceneVide();
    $b = E::lot($scene['org'], $scene['property']);
    $sortant = E::bailSurLot($scene['org'], $scene['unit'], ['starts_on' => '2026-01-01', 'ends_on' => '2026-07-01']);
    $entrant = E::bailSurLot($scene['org'], $scene['unit'], ['starts_on' => '2026-07-01', 'signed_on' => '2026-06-01']);
    C::comme($this, $scene['owner']);
    $cle = clePoids($this, $scene, 'tantiemes', [$scene['unit']->id => 64, $b->id => 936]);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['key_id' => $cle]);

    $r = E::calculer($this, $scene, $exercice)->assertOk();
    $parBail = collect($r->json('data.statements'))->keyBy('lease_id');

    expect($parBail->get($sortant->id)['occupied_days'])->toBe(181)
        ->and($parBail->get($sortant->id)['share_total']['amount'])->toBe(3048)
        ->and($parBail->get($entrant->id)['occupied_days'])->toBe(123)
        ->and($parBail->get($entrant->id)['share_total']['amount'])->toBe(2071)
        ->and($r->json('data.items.0.owner_share.amount'))->toBe(80000 - 3048 - 2071);
});

it('un bail sur deux lots cumule leurs poids', function (): void {
    $this->travelTo('2026-11-16');
    $scene = E::sceneVide();
    $b = E::lot($scene['org'], $scene['property']);
    $bail = E::bailSurLot($scene['org'], $scene['unit'], ['starts_on' => '2026-01-01']);
    $secondaire = LeasesReadContext::occuper($scene['org'], $bail, $b, ['valid_from' => '2026-01-01', 'is_main' => false]);
    C::comme($this, $scene['owner']);
    $cle = clePoids($this, $scene, 'tantiemes', [$scene['unit']->id => 64, $b->id => 936]);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['key_id' => $cle]);

    E::calculer($this, $scene, $exercice)->assertOk()->assertJsonPath('data.statements.0.share_total.amount', 80000)->assertJsonPath('data.items.0.owner_share.amount', 0);

    expect($secondaire->unit_id)->toBe($b->id);
});

it('trois baux : somme des parts et reste du propriétaire égale le poste au centime', function (): void {
    $this->travelTo('2026-11-16');
    $scene = E::sceneVide();
    $b = E::lot($scene['org'], $scene['property']);
    $c = E::lot($scene['org'], $scene['property']);
    $baux = [E::bailSurLot($scene['org'], $scene['unit'], ['starts_on' => '2026-01-01']), E::bailSurLot($scene['org'], $b, ['starts_on' => '2026-01-01']), E::bailSurLot($scene['org'], $c, ['starts_on' => '2026-01-01'])];
    C::comme($this, $scene['owner']);
    $cle = clePoids($this, $scene, 'custom', [$scene['unit']->id => 1, $b->id => 2, $c->id => 4]);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene, 10000), 10000, ['key_id' => $cle]);

    $r = E::calculer($this, $scene, $exercice)->assertOk();
    $parts = collect($r->json('data.statements'))->mapWithKeys(fn (array $d): array => [$d['lease_id'] => $d['share_total']['amount']]);

    expect([$parts[$baux[0]->id], $parts[$baux[1]->id], $parts[$baux[2]->id]])->toBe([1428, 2857, 5714])
        ->and($r->json('data.items.0.owner_share.amount'))->toBe(1);
});

it('un bail au forfait n\'est pas régularisé : sa part reste au propriétaire et il est listé', function (): void {
    $this->travelTo('2026-11-16');
    $scene = E::sceneVide();
    $bail = E::bailSurLot($scene['org'], $scene['unit'], ['starts_on' => '2026-01-01'], 'charges_flat');
    C::comme($this, $scene['owner']);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['unit_id' => $scene['unit']->id]);

    E::calculer($this, $scene, $exercice)->assertOk()
        ->assertJsonPath('data.statements', [])
        ->assertJsonPath('data.excluded_leases.0.lease_id', $bail->id)
        ->assertJsonPath('data.excluded_leases.0.reason', 'flat_rate')
        ->assertJsonPath('data.items.0.owner_share.amount', 80000);
});

it('une période de douze mois pleinement occupée suggère un douzième de la part, arrondi au demi supérieur', function (): void {
    $scene = E::scene($this, 500, 0);
    $this->travelTo('2027-02-01');
    $b = E::lot($scene['org'], $scene['property']);
    C::comme($this, $scene['owner']);
    $cle = clePoids($this, $scene, 'tantiemes', [$scene['unit']->id => 64, $b->id => 936]);
    $depense = E::depense($this, $scene, 80000, ['service_to' => '2027-01-01']);
    $exercice = E::exercice($this, $scene, ['period_end' => '2027-01-01', 'items' => [E::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => $depense, 'amount' => 80000], ['key_id' => $cle])]])->assertCreated()->json('data.id');

    E::calculer($this, $scene, $exercice)->assertOk()
        ->assertJsonPath('data.statements.0.occupied_days', 365)
        ->assertJsonPath('data.statements.0.share_total.amount', 5120)
        ->assertJsonPath('data.statements.0.suggested_monthly_provision.amount', 427);
});

it('une régularisation est recalculable : l\'aperçu précédent est remplacé, jamais dupliqué', function (): void {
    $scene = E::scene($this);
    C::comme($this, $scene['owner']);
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['unit_id' => $scene['unit']->id]);

    E::calculer($this, $scene, $exercice)->assertOk();
    $premier = E::decomptes($scene['org'], $exercice)[0]['id'];
    E::calculer($this, $scene, $exercice)->assertOk();

    $apres = E::decomptes($scene['org'], $exercice);
    expect($apres)->toHaveCount(1)->and($apres[0]['id'])->not->toBe($premier)
        ->and(L::dans($scene['org'], fn () => DB::table('charge_statement_lines')->count()))->toBe(1);
});
