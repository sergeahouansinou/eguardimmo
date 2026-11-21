<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\RentReceipt;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantRentContext as R;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = T::organisation();
    $this->moi = R::facture($this, $this->org, ['ends_on' => '2027-01-01']);
    R::encaisser($this, $this->org, $this->moi['lease'], 65000);
    $this->ressources = L::dans($this->org, fn (): array => [
        'installment' => $this->moi['installment']->id,
        'receipt' => RentReceipt::query()->firstOrFail()->id,
        'payment' => Payment::query()->firstOrFail()->id,
    ]);
    $this->chemins = fn (): array => [
        '/installments', "/installments/{$this->ressources['installment']}", "/installments/{$this->ressources['installment']}/notice/download",
        '/receipts', "/receipts/{$this->ressources['receipt']}", "/receipts/{$this->ressources['receipt']}/download",
        '/payments', "/payments/{$this->ressources['payment']}",
    ];
});

it('exige une session sur chacune des huit routes', function (): void {
    auth()->forgetGuards();

    foreach (($this->chemins)() as $chemin) {
        $this->getJson(R::URL.$chemin)->assertUnauthorized();
    }
});

it('refuse un compte sans profil locataire, non vérifié ou porteur d\'un jeton opérateur, sur chaque route', function (): void {
    foreach (($this->chemins)() as $chemin) {
        T::comme($this, User::factory()->create())->getJson(R::URL.$chemin)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
        T::comme($this, User::factory()->unverified()->create())->getJson(R::URL.$chemin)->assertForbidden()->assertJsonPath('code', 'email_unverified');
    }

    $operateur = $this->moi['user'];
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    T::comme($this, null);
    $jeton = $operateur->createToken('console', ['operator'])->plainTextToken;

    foreach (($this->chemins)() as $chemin) {
        $this->withToken($jeton)->getJson(R::URL.$chemin)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
});

it('répond 404 sur la pièce d\'un autre locataire de la même organisation, sans le distinguer d\'une pièce inconnue', function (): void {
    $autre = R::facture($this, $this->org);
    R::encaisser($this, $this->org, $autre['lease'], 65000);

    foreach (($this->chemins)() as $chemin) {
        if (! preg_match('#/(installments|receipts|payments)/#', $chemin)) {
            continue;
        }

        T::comme($this, $autre['user'])->getJson(R::URL.$chemin)->assertNotFound();
        T::comme($this, $this->moi['user'])->getJson(R::URL.preg_replace('#[0-9a-f-]{36}#', (string) Str::uuid7(), $chemin))->assertNotFound();
    }

    foreach (['installments', 'receipts', 'payments'] as $ressource) {
        $ids = collect(T::comme($this, $autre['user'])->getJson(R::URL."/{$ressource}")->assertOk()->json('data'))->pluck('id')->all();
        expect($ids)->toHaveCount(1)->not->toContain($this->ressources[Str::singular($ressource)]);
    }
});

it('répond 404 sur la pièce d\'un locataire d\'une autre organisation', function (): void {
    $ailleurs = T::organisation('Immo Loire');
    $autre = R::facture($this, $ailleurs);
    R::encaisser($this, $ailleurs, $autre['lease'], 65000);

    foreach (($this->chemins)() as $chemin) {
        if (preg_match('#/(installments|receipts|payments)/#', $chemin)) {
            T::comme($this, $autre['user'])->getJson(R::URL.$chemin)->assertNotFound();
        }
    }

    T::comme($this, $autre['user'])->getJson(R::URL.'/installments?lease='.$this->moi['lease']->id)->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $autre['user'])->getJson(R::URL.'/payments')->assertJsonCount(1, 'data');
});

it('lit les pièces de plusieurs organisations pour un même compte', function (): void {
    $ailleurs = T::organisation('Immo Loire');
    $deuxieme = R::facture($this, $ailleurs, [], $this->moi['user']);
    R::encaisser($this, $ailleurs, $deuxieme['lease'], 65000);

    foreach (['installments', 'receipts', 'payments'] as $ressource) {
        T::comme($this, $this->moi['user'])->getJson(R::URL."/{$ressource}")->assertOk()->assertJsonCount(2, 'data');
    }

    T::comme($this, $this->moi['user'])->get(R::URL."/installments/{$deuxieme['installment']->id}/notice/download")->assertOk()->assertHeader('Content-Type', 'application/pdf');
});

it('garde l\'accès jusqu\'à 12 mois après le dernier jour d\'occupation, puis plus rien', function (): void {
    $this->travelTo(CarbonImmutable::parse('2027-12-31 09:00:00'));

    foreach (($this->chemins)() as $chemin) {
        T::comme($this, $this->moi['user'])->get(R::URL.$chemin)->assertOk();
    }

    $this->travelTo(CarbonImmutable::parse('2028-01-01 00:00:01'));

    foreach (['installments', 'receipts', 'payments'] as $ressource) {
        T::comme($this, $this->moi['user'])->getJson(R::URL."/{$ressource}")->assertOk()->assertJsonCount(0, 'data');
    }

    foreach (($this->chemins)() as $chemin) {
        if (preg_match('#/(installments|receipts|payments)/#', $chemin)) {
            T::comme($this, $this->moi['user'])->getJson(R::URL.$chemin)->assertNotFound();
        }
    }
});

it('lit en un nombre de requêtes indépendant du nombre de pièces', function (): void {
    $requetes = function (string $chemin): int {
        T::comme($this, $this->moi['user']);
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(R::URL.$chemin.'?per_page=100')->assertOk();
        $total = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $total;
    };
    $avant = [$requetes('/installments'), $requetes('/receipts'), $requetes('/payments')];

    L::dans($this->org, function (): void {
        foreach (range(1, 4) as $i) {
            Installment::query()->whereKey($this->ressources['installment'])->firstOrFail()->replicate()->forceFill(['period_start' => "2025-0{$i}-01", 'period_end' => "2025-0{$i}-28", 'due_date' => "2025-0{$i}-05", 'status' => 'issued', 'ledger_entry_id' => null])->save();
            RentReceipt::query()->firstOrFail()->replicate(['active_installment_id'])->forceFill(['number' => "QT-2025-000{$i}", 'installment_id' => Installment::query()->latest('id')->firstOrFail()->id, 'voided_at' => now()])->save();
            Payment::query()->firstOrFail()->replicate()->forceFill(['idempotency_key' => "cle-supplementaire-{$i}"])->save();
        }
    });

    expect([$requetes('/installments'), $requetes('/receipts'), $requetes('/payments')])->toBe($avant);
});
