<?php

declare(strict_types=1);

use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Enums\PlanVersionStatus;
use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Shared\Database\Checks;
use App\Shared\Database\RowGuards;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 32)->unique('plans_code_unique');
            $table->string('name', 80);
            $table->datetimes(6);
        });

        Schema::create('plan_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('plan_id')->constrained('plans');
            $table->unsignedInteger('version');
            $table->string('status', 16);
            $table->unsignedSmallInteger('trial_days')->default(15);
            $table->boolean('public_signup')->default(true);
            $table->dateTime('published_at', 6)->nullable();
            $table->dateTime('archived_at', 6)->nullable();
            $table->string('draft_key', 36)->nullable()->storedAs("CASE WHEN status = 'draft' THEN plan_id END");
            $table->datetimes(6);

            $table->unique(['plan_id', 'version'], 'plan_versions_plan_version_unique');
            $table->unique('draft_key', 'plan_versions_draft_key_unique');
        });

        Schema::create('plan_prices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('plan_version_id')->constrained('plan_versions');
            $table->char('currency', 3);
            $table->unsignedBigInteger('monthly_amount');
            $table->unsignedBigInteger('yearly_amount');
            $table->datetimes(6);

            $table->unique(['plan_version_id', 'currency'], 'plan_prices_version_currency_unique');
        });

        Schema::create('plan_entitlements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('plan_version_id')->constrained('plan_versions');
            $table->string('feature_key', 32);
            $table->boolean('enabled');
            $table->unsignedBigInteger('limit_value')->nullable();
            $table->datetimes(6);

            $table->unique(['plan_version_id', 'feature_key'], 'plan_entitlements_version_feature_unique');
        });

        Schema::create('subscriptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('plan_version_id')->constrained('plan_versions');
            $table->string('status', 16);
            $table->dateTime('trial_ends_at', 6)->nullable();
            $table->dateTime('current_period_start', 6)->nullable();
            $table->dateTime('current_period_end', 6)->nullable();
            $table->char('currency', 3);
            $table->datetimes(6);

            $table->unique('organization_id', 'subscriptions_organization_unique');
            $table->index(['status', 'trial_ends_at'], 'subscriptions_status_trial_idx');
        });

        Schema::create('organization_entitlement_overrides', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('feature_key', 32);
            $table->boolean('enabled');
            $table->unsignedBigInteger('limit_value')->nullable();
            $table->dateTime('starts_at', 6);
            $table->dateTime('ends_at', 6);
            $table->string('reason_code', 24);
            $table->uuid('approval_id');
            $table->foreignUuid('granted_by_user_id')->nullable()->constrained('users');
            $table->dateTime('revoked_at', 6)->nullable();
            $table->datetimes(6);

            $table->index(['organization_id', 'feature_key'], 'org_entitlement_overrides_org_feature_idx');
            $table->unique('approval_id', 'org_entitlement_overrides_approval_unique');
        });

        Checks::add('plan_versions', 'status', Checks::enum('status', PlanVersionStatus::class));
        Checks::add('plan_versions', 'trial_days', 'trial_days BETWEEN 0 AND 90');
        Checks::add('plan_prices', 'currency', "currency IN ('EUR', 'CAD')");
        Checks::add('plan_entitlements', 'feature_key', Checks::enum('feature_key', Feature::class));
        Checks::add('subscriptions', 'status', Checks::enum('status', SubscriptionStatus::class));
        Checks::add('subscriptions', 'currency', "currency IN ('EUR', 'CAD')");
        Checks::add('organization_entitlement_overrides', 'feature_key', Checks::enum('feature_key', Feature::class));
        Checks::add('organization_entitlement_overrides', 'window', 'ends_at > starts_at');

        $figee = fn (string $parent): string => "(SELECT status FROM plan_versions WHERE id = {$parent}.plan_version_id) <> 'draft'";

        RowGuards::install([
            ['plan_versions_publiee_figee', 'BEFORE UPDATE', 'plan_versions', "OLD.status <> 'draft' AND (".RowGuards::changed(['plan_id', 'version', 'trial_days', 'public_signup', 'published_at', 'created_at']).')', 'plan_versions : version publiee figee'],
            ['plan_versions_statut_sens_unique', 'BEFORE UPDATE', 'plan_versions', "(OLD.status = 'archived' AND NEW.status <> 'archived') OR (OLD.status = 'published' AND NEW.status = 'draft')", 'plan_versions : statut irreversible'],
            ['plan_versions_sans_suppression', 'BEFORE DELETE', 'plan_versions', "OLD.status <> 'draft'", 'plan_versions : version publiee non supprimable'],
            ['plan_prices_figes_ins', 'BEFORE INSERT', 'plan_prices', $figee('NEW'), 'plan_prices : version figee'],
            ['plan_prices_figes_upd', 'BEFORE UPDATE', 'plan_prices', $figee('OLD').' OR '.$figee('NEW'), 'plan_prices : version figee'],
            ['plan_prices_figes_del', 'BEFORE DELETE', 'plan_prices', $figee('OLD'), 'plan_prices : version figee'],
            ['plan_entitlements_figes_ins', 'BEFORE INSERT', 'plan_entitlements', $figee('NEW'), 'plan_entitlements : version figee'],
            ['plan_entitlements_figes_upd', 'BEFORE UPDATE', 'plan_entitlements', $figee('OLD').' OR '.$figee('NEW'), 'plan_entitlements : version figee'],
            ['plan_entitlements_figes_del', 'BEFORE DELETE', 'plan_entitlements', $figee('OLD'), 'plan_entitlements : version figee'],
            ['org_entitlement_overrides_figee', 'BEFORE UPDATE', 'organization_entitlement_overrides', RowGuards::changed(['organization_id', 'feature_key', 'enabled', 'limit_value', 'starts_at', 'ends_at', 'reason_code', 'approval_id', 'granted_by_user_id', 'created_at']).' OR (OLD.revoked_at IS NOT NULL AND '.RowGuards::changed(['revoked_at']).')', 'organization_entitlement_overrides : derogation figee'],
            ['org_entitlement_overrides_sans_suppression', 'BEFORE DELETE', 'organization_entitlement_overrides', '1 = 1', 'organization_entitlement_overrides ne se supprime pas'],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_entitlement_overrides');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plan_entitlements');
        Schema::dropIfExists('plan_prices');
        Schema::dropIfExists('plan_versions');
        Schema::dropIfExists('plans');
    }
};
