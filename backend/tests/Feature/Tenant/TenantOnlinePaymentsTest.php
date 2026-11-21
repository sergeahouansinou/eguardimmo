<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Modules\Payments\Events\OnlinePaymentFailed;
use App\Modules\Payments\Events\PaymentConfirmed;
use App\Modules\Payments\Gateways\FakeGateway;
use App\Modules\Payments\Models\OnlinePayment;
use App\Modules\Payments\Models\PaymentAccount;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as LR;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantRentContext as R;
use Tests\Feature\Tenant\TenantWriteContext;

beforeEach(function (): void {
    C::preparer($this);
    config(['payments.gateway' => 'fake', 'payments.providers.fake.webhook_secret' => 'whsec_test']);
    $this->org = T::organisation();
    $this->moi = R::facture($this, $this->org);
    $this->echeance = $this->moi['installment'];
    $this->ouvrir = fn () => L::dans($this->org, fn () => PaymentAccount::query()->create(['provider' => 'fake', 'provider_account_id' => 'acct_fake_test', 'status' => 'ready', 'onboarded_at' => now()]));
    $this->payer = fn (array $corps = [], $compte = null) => T::comme($this, $compte ?? $this->moi['user'])->postJson('/api/v1/tenant/online-payments', [
        'lease' => $this->moi['lease']->id,
        'installments' => [$this->echeance->id],
        'method' => 'card',
        'client_id' => (string) Str::uuid7(),
        ...$corps,
    ]);
    $this->webhook = function (array $charge, ?string $secret = 'whsec_test', string $fournisseur = 'fake') {
        auth()->forgetGuards();
        $brut = (string) json_encode($charge);
        $entetes = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];

        if ($secret !== null) {
            $entetes['HTTP_X_FAKE_SIGNATURE'] = hash_hmac('sha256', $brut, $secret);
        }

        return $this->call('POST', "/api/v1/webhooks/payments/{$fournisseur}", [], [], [], $entetes, $brut);
    };
    $this->evenement = fn (string $reference, string $type, array $plus = []) => ($this->webhook)(['id' => 'evt_'.Str::lower((string) Str::ulid()), 'type' => $type, 'reference' => $reference, ...($type === 'payment.succeeded' ? ['currency' => 'EUR'] : []), ...$plus]);
    $this->creer = function (): array {
        ($this->ouvrir)();

        return ($this->payer)()->assertCreated()->json('data');
    };
    $this->reference = fn (string $id) => (string) DB::table('online_payments')->where('id', $id)->value('provider_reference');
    $this->paiementsLoyer = fn () => DB::table('rent_payments')->get();
    $this->equipe = fn ($compte) => LR::changerDeCompte($this, $compte);
    $this->lire = fn (string $id, $compte = null) => T::comme($this, $compte ?? $this->moi['user'])->getJson("/api/v1/tenant/online-payments/{$id}");
});

it('annonce les options : indisponible sans compte, puis les échéances payables et le total', function (): void {
    $url = "/api/v1/tenant/online-payments/options?lease={$this->moi['lease']->id}";

    T::comme($this, $this->moi['user'])->getJson($url)->assertOk()->assertJsonPath('data.available', false)->assertJsonPath('data.unavailable_reason', 'account_not_ready');

    ($this->ouvrir)();
    $vue = T::comme($this, $this->moi['user'])->getJson($url)->assertOk()->json('data');

    expect($vue)->toBe([
        'available' => true,
        'unavailable_reason' => null,
        'methods' => ['card'],
        'installments' => [['id' => $this->echeance->id, 'due_date' => $this->echeance->due_date->toDateString(), 'remaining' => ['amount' => 65000, 'currency' => 'EUR']]],
        'total' => ['amount' => 65000, 'currency' => 'EUR'],
    ]);

    config(['payments.gateway' => 'none']);
    T::comme($this, $this->moi['user'])->getJson($url)->assertOk()->assertJsonPath('data.unavailable_reason', 'provider_unavailable');
});

it('crée une intention au montant du grand livre : forme exacte, page hébergée, rejouable', function (): void {
    ($this->ouvrir)();
    $cle = (string) Str::uuid7();
    $cree = ($this->payer)(['client_id' => $cle, 'amount' => 1])->assertCreated();
    $vue = $cree->json('data');

    expect(array_keys($vue))->toBe(['id', 'lease_id', 'status', 'method', 'amount', 'installment_ids', 'redirect_url', 'failure_code', 'created_at', 'confirmed_at'])
        ->and($vue)->toMatchArray(['status' => 'pending', 'method' => 'card', 'amount' => ['amount' => 65000, 'currency' => 'EUR'], 'installment_ids' => [$this->echeance->id], 'failure_code' => null, 'confirmed_at' => null])
        ->and($vue['redirect_url'])->toStartWith('https://pay.fake.invalid/checkout/fake_')
        ->and(DB::table('payment_accounts')->count())->toBe(1)
        ->and(TenantWriteContext::actions())->toContain('payments.online_payment.created');

    ($this->payer)(['client_id' => $cle])->assertOk()->assertJsonPath('data.id', $vue['id']);
    ($this->payer)()->assertOk()->assertJsonPath('data.id', $vue['id']);
    ($this->payer)(['client_id' => $cle, 'installments' => [(string) Str::uuid7()]])->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');

    expect(DB::table('online_payments')->count())->toBe(1);
});

it('refuse un moyen non proposé, une échéance sans reste dû, un compte non prêt et un PSP indisponible sans rien écrire', function (): void {
    ($this->payer)()->assertConflict()->assertJsonPath('code', 'payment_account_not_ready');

    ($this->ouvrir)();
    ($this->payer)(['method' => 'direct_debit'])->assertUnprocessable()->assertJsonPath('code', 'payment_method_unsupported');
    ($this->payer)(['method' => 'cheque'])->assertUnprocessable();
    ($this->payer)(['installments' => [(string) Str::uuid7()]])->assertConflict()->assertJsonPath('code', 'payment_nothing_due');
    ($this->payer)(['installments' => []])->assertUnprocessable();
    ($this->payer)(['installments' => [$this->echeance->id, $this->echeance->id]])->assertUnprocessable();

    config(['payments.gateway' => 'none']);
    ($this->payer)()->assertStatus(503)->assertJsonPath('code', 'payment_provider_unavailable')->assertHeader('Retry-After', '60');

    expect(DB::table('online_payments')->count())->toBe(0);
});

it('confirme par webhook signé : l\'encaissement carte est imputé une seule fois, même rejoué', function (): void {
    Event::fake([PaymentConfirmed::class]);
    $intention = ($this->creer)();
    $reference = ($this->reference)($intention['id']);

    ($this->evenement)($reference, 'payment.processing')->assertOk()->assertJson(['received' => true]);
    expect(OnlinePayment::query()->withoutGlobalScopes()->find($intention['id'])->status)->toBe(OnlinePaymentStatus::Processing);

    $charge = ['id' => 'evt_unique_1', 'type' => 'payment.succeeded', 'reference' => $reference, 'amount' => 65000, 'currency' => 'EUR'];
    ($this->webhook)($charge)->assertOk();
    ($this->webhook)($charge)->assertOk();
    ($this->evenement)($reference, 'payment.succeeded', ['amount' => 65000])->assertOk();

    Event::assertDispatchedTimes(PaymentConfirmed::class, 1);
    Event::assertDispatched(PaymentConfirmed::class, fn ($e): bool => $e->idempotencyKey() === 'psp:fake:'.$reference && $e->amount === 65000 && $e->currency === 'EUR' && $e->method === 'card');
    expect(DB::table('payment_provider_events')->where('event_id', 'evt_unique_1')->count())->toBe(1)
        ->and(DB::table('payment_provider_events')->whereNull('processed_at')->count())->toBe(0)
        ->and(TenantWriteContext::actions())->toContain('payments.online_payment.succeeded');
});

it('impute l\'encaissement chez Rent avec la clé du PSP et solde l\'échéance', function (): void {
    $intention = ($this->creer)();
    $reference = ($this->reference)($intention['id']);

    ($this->evenement)($reference, 'payment.succeeded', ['amount' => 65000])->assertOk();
    ($this->evenement)($reference, 'payment.succeeded', ['amount' => 65000])->assertOk();

    $paiements = ($this->paiementsLoyer)();
    $paiement = $paiements->first();

    expect($paiements)->toHaveCount(1)
        ->and($paiement->method)->toBe('card')
        ->and($paiement->idempotency_key)->toBe('psp:fake:'.$reference)
        ->and($paiement->provider_reference)->toBe('fake:'.$reference)
        ->and((int) $paiement->amount)->toBe(65000)
        ->and(L::dans($this->org, fn () => Installment::query()->findOrFail($this->echeance->id)->status->value))->toBe('paid');

    ($this->lire)($intention['id'])->assertOk()->assertJsonPath('data.status', 'succeeded')->assertJsonPath('data.redirect_url', null);
    expect(L::dans($this->org, fn () => Payment::query()->count()))->toBe(1);
});

it('refuse toute notification mal signée, sans fournisseur connu ou au corps illisible, sans rien changer', function (): void {
    $intention = ($this->creer)();
    $reference = ($this->reference)($intention['id']);

    ($this->evenement)($reference, 'payment.succeeded')->assertOk();
    $autre = ($this->payer)(['installments' => [$this->echeance->id], 'client_id' => (string) Str::uuid7()]);

    foreach ([
        ($this->webhook)(['id' => 'e1', 'type' => 'payment.succeeded', 'reference' => $reference], 'mauvais-secret'),
        ($this->webhook)(['id' => 'e2', 'type' => 'payment.succeeded', 'reference' => $reference], null),
        ($this->webhook)(['id' => 'e3', 'type' => 'payment.succeeded', 'reference' => $reference], 'whsec_test', 'stripe'),
        ($this->webhook)(['id' => 'e4', 'type' => 'payment.succeeded', 'reference' => $reference], 'whsec_test', 'inconnu'),
    ] as $reponse) {
        $reponse->assertUnauthorized()->assertJsonPath('code', 'webhook_signature_invalid');
    }

    config(['payments.providers.fake.webhook_secret' => '']);
    ($this->webhook)(['id' => 'e5', 'type' => 'payment.succeeded', 'reference' => $reference], '')->assertUnauthorized();

    expect(DB::table('payment_provider_events')->whereIn('event_id', ['e1', 'e2', 'e3', 'e4', 'e5'])->count())->toBe(0)->and($autre->status())->toBeIn([200, 201, 409]);
});

it('garde des transitions monotones : un échec est définitif, un succès l\'emporte sur une annulation locale', function (): void {
    Event::fake([PaymentConfirmed::class, OnlinePaymentFailed::class]);
    $intention = ($this->creer)();
    $reference = ($this->reference)($intention['id']);

    ($this->evenement)($reference, 'payment.failed', ['failure_code' => 'card_declined'])->assertOk();
    ($this->evenement)($reference, 'payment.succeeded', ['amount' => 65000])->assertOk();
    ($this->evenement)($reference, 'payment.processing')->assertOk();

    $ligne = DB::table('online_payments')->where('id', $intention['id'])->first();
    expect($ligne->status)->toBe('failed')->and($ligne->failure_code)->toBe('card_declined');
    Event::assertNotDispatched(PaymentConfirmed::class);
    Event::assertDispatchedTimes(OnlinePaymentFailed::class, 1);
    ($this->lire)($intention['id'])->assertJsonPath('data.status', 'failed')->assertJsonPath('data.redirect_url', null)->assertJsonPath('data.failure_code', 'card_declined');

    $nouvelle = ($this->payer)()->assertCreated()->json('data');
    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/online-payments/{$nouvelle['id']}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
    ($this->evenement)(($this->reference)($nouvelle['id']), 'payment.succeeded', ['amount' => 65000])->assertOk();

    expect(DB::table('online_payments')->where('id', $nouvelle['id'])->value('status'))->toBe('succeeded');
    Event::assertDispatchedTimes(PaymentConfirmed::class, 1);
});

it('ne croit pas un montant confirmé différent du montant demandé', function (): void {
    Event::fake([PaymentConfirmed::class]);
    $intention = ($this->creer)();

    ($this->evenement)(($this->reference)($intention['id']), 'payment.succeeded', ['amount' => 100])->assertOk();

    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('pending');
    Event::assertNotDispatched(PaymentConfirmed::class);
    expect(($this->paiementsLoyer)())->toHaveCount(0);
});

it('annule une intention en attente, rejoue l\'annulation, refuse après succès', function (): void {
    $intention = ($this->creer)();
    $url = "/api/v1/tenant/online-payments/{$intention['id']}/cancel";

    T::comme($this, $this->moi['user'])->postJson($url)->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.redirect_url', null);
    T::comme($this, $this->moi['user'])->postJson($url)->assertOk()->assertJsonPath('data.status', 'cancelled');
    expect(TenantWriteContext::actions())->toContain('payments.online_payment.cancelled');

    $deuxieme = ($this->payer)()->assertCreated()->json('data');
    ($this->evenement)(($this->reference)($deuxieme['id']), 'payment.succeeded', ['amount' => 65000])->assertOk();
    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/online-payments/{$deuxieme['id']}/cancel")->assertConflict()->assertJsonPath('code', 'payment_not_cancellable');
});

it('cloisonne par fiche et par organisation : 404 pour un colocataire, un autre locataire ou une autre agence', function (): void {
    $intention = ($this->creer)();
    $coloc = T::colocataire($this->org, $this->moi['lease']);
    $compteColoc = User::factory()->create();
    R::rattacher($this->org, $coloc, $compteColoc);
    $voisin = T::locataire($this->org);
    $autre = T::locataire(T::organisation('Immo Loire'));

    foreach ([$compteColoc, $voisin['user'], $autre['user']] as $intrus) {
        ($this->lire)($intention['id'], $intrus)->assertNotFound()->assertJsonPath('code', 'online_payment_not_found');
        T::comme($this, $intrus)->postJson("/api/v1/tenant/online-payments/{$intention['id']}/cancel")->assertNotFound();
    }

    ($this->payer)([], $voisin['user'])->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    ($this->payer)(['lease' => $autre['lease']->id])->assertNotFound();
    T::comme($this, $voisin['user'])->getJson("/api/v1/tenant/online-payments/options?lease={$this->moi['lease']->id}")->assertNotFound();
    expect(DB::table('online_payments')->count())->toBe(1);
});

it('exige un compte locataire vérifié, sans jeton 401', function (): void {
    $intention = ($this->creer)();
    auth()->forgetGuards();
    $this->flushSession();

    $this->getJson("/api/v1/tenant/online-payments/{$intention['id']}")->assertUnauthorized();
    $this->postJson('/api/v1/tenant/online-payments', [])->assertUnauthorized();
    $this->postJson("/api/v1/tenant/online-payments/{$intention['id']}/cancel")->assertUnauthorized();
    $this->getJson('/api/v1/tenant/online-payments/options')->assertUnauthorized();
    T::comme($this, User::factory()->create())->getJson("/api/v1/tenant/online-payments/{$intention['id']}")->assertForbidden();
    T::comme($this, User::factory()->unverified()->create())->getJson("/api/v1/tenant/online-payments/{$intention['id']}")->assertForbidden();
});

it('rapproche : relit au PSP une intention ancienne et rejoue une confirmation non imputée', function (): void {
    Event::fake([PaymentConfirmed::class]);
    $intention = ($this->creer)();
    $reference = ($this->reference)($intention['id']);
    FakeGateway::settle($reference, OnlinePaymentStatus::Succeeded, 65000);

    $this->artisan('payments:reconcile')->assertSuccessful();
    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('pending');

    $this->travel(2)->days();
    $this->artisan('payments:reconcile')->assertSuccessful();

    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('succeeded');
    Event::assertDispatchedTimes(PaymentConfirmed::class, 2);
});

it('rejoue la confirmation d\'un paiement imputé : aucun second encaissement', function (): void {
    $intention = ($this->creer)();
    $reference = ($this->reference)($intention['id']);
    ($this->evenement)($reference, 'payment.succeeded', ['amount' => 65000])->assertOk();

    $this->artisan('payments:reconcile')->assertSuccessful();
    $this->artisan('payments:reconcile')->assertSuccessful();

    expect(($this->paiementsLoyer)())->toHaveCount(1);
});

it('réserve le compte de paiement au titulaire et à l\'administrateur avec 2FA récente, la liste à l\'équipe', function (): void {
    $titulaire = L::titulaire($this->org);
    activerDeuxFacteurs($titulaire);
    $comptable = L::membre($this->org, MemberRole::Accountant);
    $gestionnaire = L::membre($this->org, MemberRole::Manager);
    $url = "/api/v1/org/{$this->org->id}/payments/account";
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    $entetes = ['Origin' => 'https://agence.eguardimmo.test', 'Referer' => 'https://agence.eguardimmo.test/'];

    ($this->equipe)($titulaire)->withHeaders($entetes)->getJson($url)->assertOk()->assertJson(['data' => null]);
    ($this->equipe)($titulaire)->withHeaders($entetes)->postJson($url)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    $this->flushSession();
    ($this->equipe)($titulaire)->withHeaders($entetes)->withSession([EnsureRecentReauthentication::CLE_2FA => now()->getTimestamp()])->postJson($url)
        ->assertOk()->assertJsonPath('data.provider', 'fake')->assertJsonPath('data.status', 'ready')->assertJsonPath('data.ready', true)->assertJsonPath('data.onboarding_url', null);

    expect(array_keys(($this->equipe)($titulaire)->withHeaders($entetes)->getJson($url)->json('data')))->toBe(['provider', 'status', 'ready', 'onboarded_at', 'onboarding_url'])
        ->and(TenantWriteContext::actions())->toContain('payments.account.onboarded');

    ($this->equipe)($comptable)->getJson($url)->assertForbidden();
    ($this->equipe)($gestionnaire)->getJson($url)->assertForbidden();
    ($this->equipe)($gestionnaire)->postJson($url)->assertForbidden();

    $intention = ($this->payer)()->assertCreated()->json('data');
    foreach ([$comptable, $gestionnaire, $titulaire] as $membre) {
        $liste = ($this->equipe)($membre)->getJson("/api/v1/org/{$this->org->id}/online-payments")->assertOk();
        expect($liste->json('data.0.id'))->toBe($intention['id'])->and(array_keys($liste->json('data.0')))->toBe(['id', 'lease_id', 'party_id', 'status', 'method', 'amount', 'installment_ids', 'provider', 'provider_reference', 'failure_code', 'created_by_user_id', 'created_at', 'confirmed_at']);
    }
    ($this->equipe)($titulaire)->getJson("/api/v1/org/{$this->org->id}/online-payments?status=succeeded")->assertOk()->assertJson(['data' => []]);
    ($this->equipe)($titulaire)->getJson("/api/v1/org/{$this->org->id}/online-payments?status=bidon")->assertUnprocessable();
    ($this->equipe)(L::titulaire(T::organisation('Immo Loire')))->getJson("/api/v1/org/{$this->org->id}/online-payments")->assertNotFound();
    auth()->forgetGuards();
    $this->getJson("/api/v1/org/{$this->org->id}/online-payments")->assertUnauthorized();
    $this->getJson($url)->assertUnauthorized();
});

it('refuse une intention qui reprend une échéance déjà engagée, élargie ou non, et ne la propose plus', function (): void {
    ($this->ouvrir)();
    [$e1, $e2] = collect(C::echeances($this->org, $this->moi['lease']))->pipe(function ($liste) {
        C::emises($this->org, $this->moi['lease'], $this, '2026-12-05');
        $this->travelTo(CarbonImmutable::parse(C::AUJOURDHUI));

        return array_values(C::echeances($this->org, $this->moi['lease']));
    });
    $url = "/api/v1/tenant/online-payments/options?lease={$this->moi['lease']->id}";

    $premiere = ($this->payer)(['installments' => [$e1->id]])->assertCreated()->json('data');
    ($this->payer)(['installments' => [$e1->id, $e2->id]])->assertConflict()->assertJsonPath('code', 'payment_installments_in_progress');
    expect(DB::table('online_payments')->count())->toBe(1);

    $vue = T::comme($this, $this->moi['user'])->getJson($url)->assertOk()->json('data');
    expect(array_column($vue['installments'], 'id'))->toBe([$e2->id]);

    ($this->payer)(['installments' => [$e2->id]])->assertCreated();
    expect(T::comme($this, $this->moi['user'])->getJson($url)->json('data'))->toMatchArray(['available' => false, 'unavailable_reason' => 'payment_in_progress', 'installments' => []]);

    ($this->payer)(['installments' => [$e1->id], 'client_id' => (string) Str::uuid7()])->assertOk()->assertJsonPath('data.id', $premiere['id']);

    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/online-payments/{$premiere['id']}/cancel")->assertOk();
    ($this->payer)(['installments' => [$e1->id, $e2->id]])->assertConflict();
    ($this->payer)(['installments' => [$e1->id]])->assertCreated();
});

it('refuse à un colocataire de payer une échéance que l\'autre est en train de payer', function (): void {
    ($this->ouvrir)();
    $coloc = T::colocataire($this->org, $this->moi['lease']);
    $compteColoc = User::factory()->create();
    R::rattacher($this->org, $coloc, $compteColoc);

    ($this->payer)()->assertCreated();
    ($this->payer)([], $compteColoc)->assertConflict()->assertJsonPath('code', 'payment_installments_in_progress');

    expect(DB::table('online_payments')->count())->toBe(1)
        ->and(T::comme($this, $compteColoc)->getJson("/api/v1/tenant/online-payments/options?lease={$this->moi['lease']->id}")->json('data.installments'))->toBe([]);
});

it('refuse une nouvelle intention tant qu\'un succès n\'est pas imputé au grand livre', function (): void {
    Event::fake([PaymentConfirmed::class]);
    $intention = ($this->creer)();
    ($this->evenement)(($this->reference)($intention['id']), 'payment.succeeded', ['amount' => 65000])->assertOk();

    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('succeeded');
    ($this->payer)()->assertConflict()->assertJsonPath('code', 'payment_installments_in_progress');
});

it('n\'impute jamais deux fois la même échéance quand un succès tardif suit une annulation locale', function (): void {
    $premiere = ($this->creer)();
    T::comme($this, $this->moi['user'])->postJson("/api/v1/tenant/online-payments/{$premiere['id']}/cancel")->assertOk();
    $seconde = ($this->payer)()->assertCreated()->json('data');

    ($this->evenement)(($this->reference)($seconde['id']), 'payment.succeeded', ['amount' => 65000])->assertOk();
    ($this->evenement)(($this->reference)($premiere['id']), 'payment.succeeded', ['amount' => 65000])->assertOk();

    $imputations = DB::table('rent_payment_allocations')->where('installment_id', $this->echeance->id)->get();

    expect(DB::table('rent_payments')->count())->toBe(2)
        ->and($imputations)->toHaveCount(1)
        ->and((int) $imputations->sum('amount'))->toBe(65000)
        ->and((string) DB::table('audit_logs')->where('action', 'payments.online_payment.succeeded')->pluck('metadata')->implode(''))->toContain('late');
});

it('ne croit jamais un succès sans montant ou devise, ni avec un autre montant ou une autre devise', function (): void {
    Event::fake([PaymentConfirmed::class]);
    $intention = ($this->creer)();
    $reference = ($this->reference)($intention['id']);

    foreach ([['amount' => 65000, 'currency' => null], ['amount' => null, 'currency' => 'EUR'], ['amount' => 65000, 'currency' => 'USD'], ['amount' => 64999, 'currency' => 'EUR']] as $rang => $ecart) {
        ($this->webhook)(['id' => "evt_ecart_{$rang}", 'type' => 'payment.succeeded', 'reference' => $reference, ...array_filter($ecart, fn ($v): bool => $v !== null)])->assertOk();
    }

    Event::assertNotDispatched(PaymentConfirmed::class);
    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('pending')
        ->and(DB::table('audit_logs')->where('action', 'payments.online_payment.mismatch')->count())->toBe(4)
        ->and((string) DB::table('audit_logs')->where('action', 'payments.online_payment.mismatch')->pluck('metadata')->implode(''))->toContain('missing')->toContain('currency')->toContain('amount');

    FakeGateway::settle($reference, OnlinePaymentStatus::Succeeded, 65000, 'USD');
    $this->travel(2)->days();
    $this->artisan('payments:reconcile')->assertSuccessful();

    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('pending');
    Event::assertNotDispatched(PaymentConfirmed::class);
});

it('rattache l\'encaissement carte à la fiche du payeur, pas à celle de la première échéance', function (): void {
    ($this->ouvrir)();
    $coloc = T::colocataire($this->org, $this->moi['lease']);
    $compteColoc = User::factory()->create();
    R::rattacher($this->org, $coloc, $compteColoc);

    $intention = ($this->payer)([], $compteColoc)->assertCreated()->json('data');
    ($this->evenement)(($this->reference)($intention['id']), 'payment.succeeded', ['amount' => 65000])->assertOk();

    expect(DB::table('rent_payments')->value('party_id'))->toBe($coloc->id)->and($coloc->id)->not->toBe($this->moi['party']->id);
});

it('lève une alerte auditée et journalisée quand Rent refuse définitivement un encaissement confirmé', function (): void {
    Log::spy();
    $intention = ($this->creer)();
    $reference = ($this->reference)($intention['id']);

    expect(fn () => event(new PaymentConfirmed($intention['id'], $this->org->id, $this->moi['lease']->id, $this->moi['party']->id, 'fake', $reference, 0, 'EUR', 'card', '2026-11-16')))->toThrow(ApiProblem::class);

    Log::shouldHaveReceived('critical')->withArgs(fn (string $message): bool => str_contains($message, 'refusé par Rent'))->once();
    expect(DB::table('audit_logs')->where('action', 'rent.card_payment.rejected')->count())->toBe(1)
        ->and(DB::table('rent_payments')->count())->toBe(0);
});

it('ne propose ni n\'accepte le paiement d\'une échéance due à partir de la sortie de ma ligne, alors que je règle encore celle d\'avant', function (): void {
    ($this->ouvrir)();
    $due = $this->echeance->due_date->toDateString();
    $sortie = fn (string $jour) => DB::table('lease_parties')->where('lease_id', $this->moi['lease']->id)->where('party_id', $this->moi['party']->id)->update(['valid_to' => $jour]);
    $options = fn () => T::comme($this, $this->moi['user'])->getJson("/api/v1/tenant/online-payments/options?lease={$this->moi['lease']->id}")->assertOk();

    $sortie(CarbonImmutable::parse($due)->addDay()->toDateString());
    $options()->assertJsonCount(1, 'data.installments');

    $sortie($due);
    $options()->assertJsonCount(0, 'data.installments')->assertJsonPath('data.unavailable_reason', 'nothing_due');
    ($this->payer)()->assertConflict()->assertJsonPath('code', 'payment_nothing_due');
    expect(DB::table('online_payments')->count())->toBe(0);
});

it('rapproche toutes les pages : des intentions ignorées du PSP n\'occupent pas la fenêtre devant une intention réglée', function (): void {
    config(['payments.reconcile_batch' => 2]);
    $intention = ($this->creer)();
    $base = (array) DB::table('online_payments')->where('id', $intention['id'])->first();
    unset($base['live_key']);

    foreach (range(1, 3) as $n) {
        DB::table('online_payments')->insert([...$base, 'id' => (string) Str::uuid7(now()->subDays(3)), 'client_id' => (string) Str::uuid7(), 'installments_hash' => hash('sha256', "fantome{$n}"), 'provider_reference' => "ghost_{$n}", 'created_at' => now()->subDays(2)]);
    }

    FakeGateway::settle(($this->reference)($intention['id']), OnlinePaymentStatus::Succeeded, 65000);
    $this->travel(2)->days();
    $this->artisan('payments:reconcile')->assertSuccessful();

    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('succeeded')
        ->and(DB::table('online_payments')->where('provider_reference', 'like', 'ghost_%')->where('status', 'pending')->count())->toBe(3);
});

it('fait expirer localement une intention que le PSP ignore au-delà du délai d\'abandon, pas avant', function (): void {
    $intention = ($this->creer)();
    $this->travel(6)->days();
    $this->artisan('payments:reconcile')->assertSuccessful();
    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('pending');

    $this->travel(2)->days();
    $this->artisan('payments:reconcile')->assertSuccessful();

    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('expired');

    FakeGateway::settle(($this->reference)($intention['id']), OnlinePaymentStatus::Succeeded, 65000);
    ($this->evenement)(($this->reference)($intention['id']), 'payment.succeeded', ['amount' => 65000])->assertOk();
    expect(DB::table('online_payments')->where('id', $intention['id'])->value('status'))->toBe('succeeded');
});
