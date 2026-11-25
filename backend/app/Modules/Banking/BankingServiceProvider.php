<?php

declare(strict_types=1);

namespace App\Modules\Banking;

use App\Modules\Banking\Console\SuggestCommand;
use App\Modules\Banking\Console\VerifyCommand;
use App\Modules\Banking\Http\Middleware\RequireTwoFactorInAgency;
use App\Modules\Banking\Models\BankCounterpartyLink;
use App\Modules\Banking\Models\BankMatch;
use App\Modules\Banking\Models\BankMatchItem;
use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Banking\Models\BankRule;
use App\Modules\Banking\Models\BankStatement;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\BankSuggestion;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Shared\Http\RateLimitIp;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class BankingServiceProvider extends ServiceProvider
{
    public function boot(Router $routeur): void
    {
        $routeur->aliasMiddleware('banking.two-factor', RequireTwoFactorInAgency::class);

        RateLimiter::for('banking-import', fn (Request $requete): Limit => Limit::perHour(30)->by($this->cle('banking-import', $requete)));
        RateLimiter::for('banking-apercu', fn (Request $requete): Limit => Limit::perHour(60)->by($this->cle('banking-apercu', $requete)));

        if ($this->app->runningInConsole()) {
            $this->commands([VerifyCommand::class, SuggestCommand::class]);
        }

        Relation::enforceMorphMap([
            'organization_bank_account' => OrganizationBankAccount::class,
            'bank_statement' => BankStatement::class,
            'bank_statement_line' => BankStatementLine::class,
            'bank_match' => BankMatch::class,
            'bank_match_item' => BankMatchItem::class,
            'bank_suggestion' => BankSuggestion::class,
            'bank_rule' => BankRule::class,
            'bank_counterparty_link' => BankCounterpartyLink::class,
            'bank_reconciliation' => BankReconciliation::class,
        ]);
    }

    private function cle(string $limiteur, Request $requete): string
    {
        return $limiteur.':'.(string) $requete->route('organization').':'.(string) ($requete->user()?->getAuthIdentifier() ?? RateLimitIp::of($requete));
    }
}
