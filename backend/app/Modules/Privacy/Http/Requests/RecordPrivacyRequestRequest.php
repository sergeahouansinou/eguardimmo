<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Requests;

use App\Modules\Privacy\Enums\RequestChannel;
use App\Modules\Privacy\Enums\RequestKind;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RecordPrivacyRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'kind' => ['required', 'string', Rule::enum(RequestKind::class)],
            'channel' => ['required', 'string', Rule::in([RequestChannel::Email->value, RequestChannel::Letter->value])],
            'requester_email' => ['required', 'string', 'email:rfc', 'max:254'],
            'received_on' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:'.now()->subYear()->toDateString()],
        ];
    }

    public function kind(): RequestKind
    {
        return RequestKind::from((string) $this->validated('kind'));
    }

    public function channel(): RequestChannel
    {
        return RequestChannel::from((string) $this->validated('channel'));
    }

    public function requesterEmail(): string
    {
        return (string) $this->validated('requester_email');
    }

    public function receivedAt(): CarbonImmutable
    {
        return $this->filled('received_on') ? CarbonImmutable::parse((string) $this->validated('received_on'))->startOfDay() : CarbonImmutable::now();
    }
}
